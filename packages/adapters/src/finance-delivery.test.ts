import { randomUUID } from "node:crypto";
import { createDb } from "@marketbot/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FinanceDeliveryService, isFinanceQuietTime } from "./finance-delivery.js";

describe("finance quiet hours", () => {
  it("uses the user's timezone including intervals across midnight", () => {
    expect(
      isFinanceQuietTime(new Date("2026-10-12T15:00:00Z"), {
        timezone: "Asia/Shanghai",
        quietStart: 22,
        quietEnd: 8,
      }),
    ).toBe(true);
    expect(
      isFinanceQuietTime(new Date("2026-10-12T00:00:00Z"), {
        timezone: "Asia/Shanghai",
        quietStart: 22,
        quietEnd: 8,
      }),
    ).toBe(false);
    expect(isFinanceQuietTime(new Date(), { timezone: "UTC", quietStart: 0, quietEnd: 0 })).toBe(
      false,
    );
  });
});

const url = process.env.VERIFY_DATABASE ? process.env.DATABASE_URL : undefined;
describe.skipIf(!url)("financial notification delivery PostgreSQL workflow", () => {
  const { prisma, pool } = createDb(url ?? "postgres://unused");
  const userId = `delivery-test-${randomUUID()}`;
  const now = new Date("2026-10-12T10:00:00Z");
  const sender = {
    hasPushRecipient: vi.fn(async (_subject: string) => true),
    deliverFinance: vi.fn(
      async (_message: unknown, _context: unknown): Promise<"accepted" | "unavailable"> =>
        "accepted",
    ),
  };
  const service = new FinanceDeliveryService(prisma, sender);
  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, name: "Delivery test", email: `${userId}@example.test` },
    });
    await prisma.financePreference.create({
      data: { userId, timezone: "UTC", quietStart: 0, quietEnd: 0 },
    });
  });
  beforeEach(async () => {
    await prisma.financeNotification.deleteMany({ where: { userId } });
    await prisma.financePreference.update({
      where: { userId },
      data: { pushEnabled: true, quietStart: 0, quietEnd: 0 },
    });
    sender.hasPushRecipient
      .mockReset()
      .mockImplementation(async (subject: string) => subject === userId);
    sender.deliverFinance.mockReset().mockResolvedValue("accepted");
  });
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    await pool.end();
  });
  const notification = (kind = "intelligence.daily") =>
    prisma.financeNotification.create({
      data: {
        userId,
        eventId: randomUUID(),
        kind,
        title: "Actual archived brief",
        body: "Source-backed content",
        recordedAt: now,
        nextPushAt: now,
      },
    });

  it("claims a business notification once concurrently and records acceptance separately from reading", async () => {
    const row = await notification();
    await Promise.all([service.deliverDue(now), service.deliverDue(now)]);
    expect(sender.deliverFinance).toHaveBeenCalledTimes(1);
    const saved = await prisma.financeNotification.findUniqueOrThrow({ where: { id: row.id } });
    expect(saved.pushStatus).toBe("accepted");
    expect(saved.readAt).toBeNull();
    expect(saved.pushAttempts).toBe(1);
    expect(await prisma.financePushAttempt.count({ where: { notificationId: row.id } })).toBe(1);
  });
  it("keeps station records when no device token exists and never pushes integration test records", async () => {
    const row = await notification();
    await notification("integration.test");
    sender.hasPushRecipient.mockResolvedValue(false);
    await service.deliverDue(now);
    expect(sender.deliverFinance).not.toHaveBeenCalled();
    const saved = await prisma.financeNotification.findUniqueOrThrow({ where: { id: row.id } });
    expect(saved.pushStatus).toBe("unavailable");
    expect(saved.pushAttempts).toBe(0);
    expect(await prisma.financeNotification.count({ where: { userId } })).toBe(2);
  });
  it("preserves mute and quiet-hour preferences without making external requests", async () => {
    const row = await notification();
    await prisma.financePreference.update({
      where: { userId },
      data: { quietStart: 9, quietEnd: 11 },
    });
    await service.deliverDue(now);
    expect(
      (
        await prisma.financeNotification.findUniqueOrThrow({ where: { id: row.id } })
      ).nextPushAt.getTime(),
    ).toBeGreaterThan(now.getTime());
    expect(sender.deliverFinance).not.toHaveBeenCalled();
    await prisma.financePreference.update({ where: { userId }, data: { pushEnabled: false } });
    await service.deliverDue(new Date(now.getTime() + 900_000));
    expect(
      (await prisma.financeNotification.findUniqueOrThrow({ where: { id: row.id } })).pushStatus,
    ).toBe("muted");
  });
  it("records uncertain network outcomes and retries using the same business collapse identity", async () => {
    const row = await notification();
    sender.deliverFinance.mockRejectedValueOnce(new Error("private transport detail"));
    await service.deliverDue(now);
    expect(
      (await prisma.financeNotification.findUniqueOrThrow({ where: { id: row.id } })).pushStatus,
    ).toBe("uncertain");
    await service.deliverDue(new Date(now.getTime() + 120_000));
    const messages = sender.deliverFinance.mock.calls.map((call) => call[0]) as Array<{
      id: string;
      deliveryId: string;
    }>;
    expect(messages.map((item) => item.id)).toEqual([row.id, row.id]);
    expect(messages[0]?.deliveryId).not.toBe(messages[1]?.deliveryId);
    expect(
      (
        await prisma.financePushAttempt.findMany({
          where: { notificationId: row.id },
          orderBy: { startedAt: "asc" },
        })
      ).map((item) => item.status),
    ).toEqual(["uncertain", "accepted"]);
  });
  it("retains uncertainty after a crashed send and lets concurrent reading win", async () => {
    const row = await notification();
    await prisma.financePushAttempt.create({
      data: { notificationId: row.id, deliveryId: "crashed-attempt", status: "started" },
    });
    await prisma.financeNotification.update({
      where: { id: row.id },
      data: { leaseToken: "dead-worker", leaseUntil: new Date(now.getTime() - 1) },
    });
    sender.deliverFinance.mockImplementationOnce(async () => {
      await prisma.financeNotification.update({
        where: { id: row.id },
        data: { readAt: now, pushStatus: "read" },
      });
      return "accepted";
    });
    await service.deliverDue(now);
    expect(
      (
        await prisma.financePushAttempt.findUniqueOrThrow({
          where: { deliveryId: "crashed-attempt" },
        })
      ).status,
    ).toBe("uncertain");
    expect(
      (await prisma.financeNotification.findUniqueOrThrow({ where: { id: row.id } })).pushStatus,
    ).toBe("read");
  });
});
