import { randomUUID } from "node:crypto";
import type { FinanceEventPage } from "@marketbot/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./client.js";
import { ingestFinanceEvents } from "./finance-events.js";

// Opt-in integration tests use only the disposable project-owned PostgreSQL.
const url = process.env.VERIFY_DATABASE ? process.env.DATABASE_URL : undefined;
describe.skipIf(!url)("financial inbox PostgreSQL transactions", () => {
  const { prisma, pool } = createDb(url ?? "postgres://unused");
  const userId = `finance-test-${randomUUID()}`;
  const issuer = "integration-test";
  const page: FinanceEventPage = {
    streamId: randomUUID(),
    highWater: 2,
    after: 0,
    events: [1, 2].map((sequence) => ({
      id: randomUUID(),
      sequence,
      kind: "integration.test",
      recordedAt: "2026-10-12T00:00:00.000Z",
      simulationDate: null,
      executionPrecision: null,
      payload: { synthetic: true },
    })),
  };
  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, name: "Financial integration test", email: `${userId}@example.test` },
    });
  });
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    await pool.end();
  });
  it("rolls back inbox, notification and cursor together on a gap", async () => {
    const gap = {
      ...page,
      events: [page.events[0]!, { ...page.events[1]!, sequence: 3 }],
      highWater: 3,
    };
    await expect(ingestFinanceEvents(prisma, userId, issuer, gap)).rejects.toThrow();
    expect(await prisma.financeEventInbox.count({ where: { userId } })).toBe(0);
    expect(await prisma.financeNotification.count({ where: { userId } })).toBe(0);
    expect(await prisma.financeEventCursor.findUnique({ where: { userId } })).toBeNull();
  });
  it("concurrent replay creates one inbox entry and notification per business event", async () => {
    const result = await Promise.all([
      ingestFinanceEvents(prisma, userId, issuer, page),
      ingestFinanceEvents(prisma, userId, issuer, page),
    ]);
    expect(result.reduce((total, value) => total + value, 0)).toBe(2);
    expect(await prisma.financeEventInbox.count({ where: { userId } })).toBe(2);
    expect(await prisma.financeNotification.count({ where: { userId } })).toBe(2);
    expect(
      (await prisma.financeEventCursor.findUniqueOrThrow({ where: { userId } })).sequence,
    ).toBe(2n);
  });
  it("halts on an older restored database, stream change or mutated event identity", async () => {
    await expect(
      ingestFinanceEvents(prisma, userId, issuer, { ...page, after: 2, highWater: 1, events: [] }),
    ).rejects.toThrow();
    await expect(
      ingestFinanceEvents(prisma, userId, issuer, { ...page, streamId: "other-stream" }),
    ).rejects.toThrow();
    await expect(
      ingestFinanceEvents(prisma, userId, issuer, {
        ...page,
        events: [{ ...page.events[0]!, id: "changed-id" }, page.events[1]!],
      }),
    ).rejects.toThrow();
    await expect(
      ingestFinanceEvents(prisma, userId, issuer, {
        ...page,
        events: [
          { ...page.events[0]!, kind: "integration.test", payload: { synthetic: false } },
          page.events[1]!,
        ],
      }),
    ).rejects.toThrow();
    expect(await prisma.financeNotification.count({ where: { userId } })).toBe(2);
  });
  it("archives valuation events without pushing and notifies only committed simulation trades", async () => {
    const payload = {
      runId: 1,
      name: "BTC日线模拟",
      status: "active",
      ledgerPrecision: "decimal_v1" as const,
      cash: "9000.00",
      equity: "10000.00",
      currency: "USDT",
      trades: [],
    };
    const valuation = {
      id: randomUUID(),
      sequence: 3,
      kind: "simulation.day" as const,
      recordedAt: "2026-10-12T00:00:00.000Z",
      simulationDate: "2026-10-11",
      executionPrecision: "day" as const,
      payload,
    };
    const trade = {
      symbol: "BTCUSDT",
      side: "buy" as const,
      status: "filled" as const,
      quantity: "0.010000",
      price: "100000.00",
      fee: "1.00",
      slippage: "0.50",
      signalDate: "2026-10-10",
      reason: "内置规则",
    };
    const traded = {
      ...valuation,
      id: randomUUID(),
      sequence: 4,
      payload: { ...payload, trades: [trade] },
    };
    const next = { ...page, after: 2, highWater: 4, events: [valuation, traded] };
    await ingestFinanceEvents(prisma, userId, issuer, next);
    await ingestFinanceEvents(prisma, userId, issuer, next);
    expect(await prisma.financeEventInbox.count({ where: { userId } })).toBe(4);
    expect(await prisma.financeNotification.count({ where: { userId } })).toBe(3);
    const notice = await prisma.financeNotification.findFirstOrThrow({
      where: { userId, eventId: traded.id },
    });
    expect(notice.body).toContain("1 笔模拟成交");
    expect(notice.body).toContain("日线精度");
    expect(notice.title).toContain("2026-10-11");
  });
});
