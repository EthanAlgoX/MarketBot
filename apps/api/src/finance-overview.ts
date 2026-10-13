import type { FinanceOverview } from "@marketbot/contracts";
import type { FinanceBridgeClient } from "@marketbot/core";
import { unconfiguredFinanceOverview } from "@marketbot/core";
import type { PrismaClient } from "@marketbot/db";

/** Joins consumer health, never account or ledger data, onto the financial DTO. */
export async function financeOverview(
  prisma: PrismaClient,
  bridge: FinanceBridgeClient | undefined,
  userId: string,
): Promise<FinanceOverview> {
  if (!bridge) return unconfiguredFinanceOverview;
  const overview = await bridge.overview(userId);
  if (!overview.data) return overview;
  const cursor = await prisma.financeEventCursor.findUnique({ where: { userId } });
  const sequence = Number(cursor?.sequence ?? 0);
  const highWater = overview.data.health.eventHighWater;
  const restoredBehind = !Number.isSafeInteger(sequence) || sequence > highWater;
  const status =
    restoredBehind || cursor?.status === "recovery_required"
      ? "recovery_required"
      : !cursor
        ? "pending"
        : cursor.status === "ready"
          ? "ready"
          : "unavailable";
  overview.data.health.eventSync = {
    status,
    cursor: Number.isSafeInteger(sequence) ? sequence : 0,
    lag: restoredBehind ? 0 : Math.max(0, highWater - sequence),
    updatedAt: cursor?.updatedAt.toISOString() ?? null,
  };
  if (status === "recovery_required" || status === "unavailable")
    overview.data.health.status = "degraded";
  return overview;
}
