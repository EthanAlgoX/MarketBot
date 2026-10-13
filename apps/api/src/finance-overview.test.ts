import type { FinanceOverview } from "@marketbot/contracts";
import type { FinanceBridgeClient } from "@marketbot/core";
import type { PrismaClient } from "@marketbot/db";
import { describe, expect, it, vi } from "vitest";
import { financeOverview } from "./finance-overview.js";

describe("financial consumer health", () => {
  const fixture = {
    availability: "ready",
    message: null,
    data: { health: { eventHighWater: 5 } },
  } as FinanceOverview;
  it("exposes a restore behind the committed cursor instead of a healthy empty backlog", async () => {
    const findUnique = vi.fn(async () => ({
      sequence: 6n,
      status: "ready",
      updatedAt: new Date("2026-10-12T00:00:00Z"),
    }));
    const prisma = { financeEventCursor: { findUnique } } as unknown as PrismaClient;
    const bridge = {
      overview: async () => structuredClone(fixture),
    } as unknown as FinanceBridgeClient;
    const view = await financeOverview(prisma, bridge, "trusted-user");
    expect(view.data?.health.eventSync?.status).toBe("recovery_required");
    expect(view.data?.health.status).toBe("degraded");
    expect(findUnique).toHaveBeenCalledExactlyOnceWith({ where: { userId: "trusted-user" } });
  });
  it("shows a pending first sync and the actual backlog", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ sequence: 2n, status: "ready", updatedAt: new Date() });
    const prisma = { financeEventCursor: { findUnique } } as unknown as PrismaClient;
    const bridge = {
      overview: async () => structuredClone(fixture),
    } as unknown as FinanceBridgeClient;
    expect((await financeOverview(prisma, bridge, "user")).data?.health.eventSync).toMatchObject({
      status: "pending",
      lag: 5,
      cursor: 0,
    });
    expect((await financeOverview(prisma, bridge, "user")).data?.health.eventSync).toMatchObject({
      status: "ready",
      lag: 3,
      cursor: 2,
    });
  });
});
