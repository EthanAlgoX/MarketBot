import { randomUUID } from "node:crypto";
import type { FinanceResearchRequest, FinanceSimulationCatalog } from "@marketbot/contracts";
import { FinanceRuleDraftInputSchema } from "@marketbot/contracts";
import { createDb } from "@marketbot/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ResearchObservations, ResearchRuleDrafts } from "./research-observations.js";

const url = process.env.VERIFY_DATABASE ? process.env.DATABASE_URL : undefined;
describe.skipIf(!url)("research rule draft PostgreSQL persistence and ownership", () => {
  const { prisma, pool } = createDb(url ?? "postgres://unused");
  const a = `draft-a-${randomUUID()}`;
  const b = `draft-b-${randomUUID()}`;
  // Boundary-only research fixture. It is not a runtime model or a user workspace seed.
  const task: FinanceResearchRequest = {
    id: "owned-research",
    commandType: "research.create",
    idempotencyKey: "original-research-key",
    status: "succeeded",
    request: { market: "crypto", symbol: "BTCUSDT" },
    resultRef: { kind: "analysis_history", historyId: 1 },
    result: { report: { summary: { analysis_summary: "Synthetic original research" } } },
    error: null,
    createdAt: "2026-10-12T00:00:00Z",
    startedAt: null,
    completedAt: null,
    modelOutputs: [],
    cost: null,
    currency: null,
  };
  const request = vi.fn(async (userId: string) => {
    if (userId !== a) throw new Error("unbound");
    return structuredClone(task);
  });
  const catalog: FinanceSimulationCatalog = {
    enabled: true,
    markets: ["crypto"],
    rules: [
      { id: "crypto_btc_hold", name: "BTC hold", market: "crypto", available: true, reason: null },
    ],
  };
  const available = vi.fn(async () => ({
    catalog: structuredClone(catalog),
    supportedCommands: ["simulation.create"],
  }));
  const observations = new ResearchObservations(prisma, request);
  const drafts = new ResearchRuleDrafts(prisma, available);
  let observationId: string;
  const configuration = {
    name: "Explicit BTC rule",
    market: "crypto",
    mode: "paper",
    symbols: ["BTCUSDT"],
    ruleId: "crypto_btc_hold",
    initialCash: "1000",
    commissionRate: "0.001",
    slippageRate: "0.0005",
    sellTaxRate: "0",
  };
  const input = () =>
    FinanceRuleDraftInputSchema.parse({
      observationId,
      idempotencyKey: "owned-rule-draft-intent",
      configuration,
    });
  beforeAll(async () => {
    for (const id of [a, b])
      await prisma.user.create({
        data: { id, name: "Draft regression user", email: `${id}@example.test` },
      });
    observationId = (
      await observations.save(a, {
        requestId: task.id,
        idempotencyKey: "original-observation",
        note: "User-authored condition",
        validUntil: null,
        invalidationCondition: "A future contradicting source requires manual review",
      })
    ).id;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [a, b] } } });
    await prisma.$disconnect();
    await pool.end();
  });
  it("persists concurrent duplicate drafts once with their complete immutable research snapshot", async () => {
    task.result = { report: { summary: { analysis_summary: "Later research changed" } } };
    const [first, second] = await Promise.all([drafts.save(a, input()), drafts.save(a, input())]);
    expect(first.id).toBe(second.id);
    expect(first.status).toBe("draft");
    expect(first.versionBinding).toBe("on_simulation_create");
    expect(first.researchSnapshot).toMatchObject({
      request: { symbol: "BTCUSDT" },
      resultRef: { historyId: 1 },
      result: { report: { summary: { analysis_summary: "Synthetic original research" } } },
    });
    expect(first.researchSnapshotDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(await prisma.researchRuleDraft.count({ where: { userId: a } })).toBe(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect((await observations.list(a))[0]?.invalidationCondition).toContain("manual review");
  });
  it("rejects key-content conflicts and hides foreign observations, drafts, and receipts", async () => {
    await expect(
      drafts.save(a, {
        ...input(),
        configuration: { ...input().configuration, initialCash: "2000" },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await drafts.list(b)).toEqual([]);
    expect(await drafts.status(b, input().idempotencyKey)).toBeNull();
    const calls = available.mock.calls.length;
    await expect(drafts.save(b, input())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      drafts.save(b, { ...input(), observationId: "missing-observation" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(available.mock.calls).toHaveLength(calls);
    const first = (await drafts.list(a))[0]!;
    await expect(
      prisma.researchRuleDraft.create({
        data: {
          userId: b,
          observationId,
          requestId: task.id,
          idempotencyKey: "forged-db-link",
          requestHash: "x",
          configuration: first.configuration,
          rule: first.rule,
          researchSnapshot: first.researchSnapshot,
          researchSnapshotDigest: first.researchSnapshotDigest,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
  it("preserves old receipts after a gate closes but rejects every new unavailable rule draft", async () => {
    const original = (await drafts.list(a))[0]!;
    catalog.enabled = false;
    expect((await drafts.save(a, input())).id).toBe(original.id);
    await expect(
      drafts.save(a, { ...input(), idempotencyKey: "closed-catalog-intent" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    catalog.enabled = true;
    available.mockResolvedValueOnce({ catalog, supportedCommands: [] });
    await expect(
      drafts.save(a, { ...input(), idempotencyKey: "missing-command-intent" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    catalog.rules[0]!.available = false;
    await expect(
      drafts.save(a, { ...input(), idempotencyKey: "unavailable-rule-intent" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await prisma.researchRuleDraft.count({ where: { userId: a } })).toBe(1);
  });
  it("rejects future market dates before persistence and re-evaluates the clock for each new intent", async () => {
    catalog.enabled = true;
    catalog.rules[0]!.available = true;
    let now = new Date("2026-10-12T23:30:00Z");
    const timed = new ResearchRuleDrafts(prisma, available, () => now);
    const before = await prisma.researchRuleDraft.count({ where: { userId: a } });
    const future = {
      ...input(),
      idempotencyKey: "market-date-intent",
      configuration: {
        ...input().configuration,
        mode: "backtest" as const,
        startDate: "2026-10-11",
        endDate: "2026-10-12",
      },
    };
    await expect(timed.save(a, future)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await prisma.researchRuleDraft.count({ where: { userId: a } })).toBe(before);
    now = new Date("2026-10-13T00:00:00Z");
    const saved = await timed.save(a, future);
    expect(saved.status).toBe("draft");
    now = new Date("2026-10-12T00:00:00Z");
    expect((await timed.save(a, future)).id).toBe(saved.id);
    await expect(
      timed.save(a, { ...future, idempotencyKey: "new-market-date-intent" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
