import { randomUUID } from "node:crypto";
import type { FinanceResearchRequest } from "@marketbot/contracts";
import { createDb } from "@marketbot/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ResearchObservations } from "./research-observations.js";

const url = process.env.VERIFY_DATABASE ? process.env.DATABASE_URL : undefined;
describe.skipIf(!url)("immutable research observations PostgreSQL workflow", () => {
  const { prisma, pool } = createDb(url ?? "postgres://unused");
  const userId = `observation-test-${randomUUID()}`;
  const task: FinanceResearchRequest = {
    id: "owned-research",
    commandType: "research.create",
    idempotencyKey: "original-research-key",
    status: "succeeded",
    request: { symbol: "BTCUSDT" },
    resultRef: { kind: "analysis_history", historyId: 1 },
    result: { report: { summary: { analysis_summary: "Synthetic original finding" } } },
    error: null,
    createdAt: "2026-10-12T00:00:00Z",
    startedAt: null,
    completedAt: null,
    modelOutputs: [],
    cost: null,
    currency: null,
  };
  const request = vi.fn(async (subject: string) => {
    if (subject !== userId) throw new Error("unbound");
    return structuredClone(task);
  });
  const service = new ResearchObservations(prisma, request);
  const input = {
    requestId: task.id,
    idempotencyKey: "save-observation-key",
    note: "Observe the stated condition",
    validUntil: null,
    invalidationCondition: null,
  };
  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, name: "Observation test", email: `${userId}@example.test` },
    });
  });
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    await pool.end();
  });
  it("deduplicates concurrent saves while preserving the original research snapshot", async () => {
    const [a, b] = await Promise.all([service.save(userId, input), service.save(userId, input)]);
    expect(a.id).toBe(b.id);
    expect(a.summary).toBe("Synthetic original finding");
    task.result = { report: { summary: { analysis_summary: "Later changed finding" } } };
    expect((await service.list(userId))[0]?.summary).toBe("Synthetic original finding");
    expect(
      (await prisma.researchObservation.findUniqueOrThrow({ where: { id: a.id } })).snapshot,
    ).toMatchObject({
      result: { report: { summary: { analysis_summary: "Synthetic original finding" } } },
    });
    expect(await prisma.researchObservation.count({ where: { userId } })).toBe(1);
  });
  it("conceals another user's observations and rejects changed idempotency content", async () => {
    expect(await service.list("other-user")).toEqual([]);
    await expect(service.save(userId, { ...input, note: "Different note" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(service.save("other-user", input)).rejects.toThrow("unbound");
  });
  it("rejects expired observations or incomplete research without inventing a saved result", async () => {
    await expect(
      service.save(userId, {
        ...input,
        idempotencyKey: "expired-note-key",
        validUntil: "2020-01-01T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    task.status = "failed";
    await expect(
      service.save(userId, { ...input, idempotencyKey: "failed-research-key" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await prisma.researchObservation.count({ where: { userId } })).toBe(1);
  });
});
