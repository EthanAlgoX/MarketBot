import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@marketbot/db";
import { DEFAULT_INTELLIGENCE_PREFERENCES } from "./intelligence-service.js";

export interface FinancePushSender {
  hasPushRecipient(userId: string): Promise<boolean>;
  deliverFinance(
    message: { id: string; deliveryId: string; title: string; body: string },
    context: { userId: string; signal: AbortSignal },
  ): Promise<"accepted" | "unavailable">;
}

export function isFinanceQuietTime(
  now: Date,
  prefs: { timezone: string; quietStart: number; quietEnd: number },
): boolean {
  if (prefs.quietStart === prefs.quietEnd) return false;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: prefs.timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  return prefs.quietStart < prefs.quietEnd
    ? hour >= prefs.quietStart && hour < prefs.quietEnd
    : hour >= prefs.quietStart || hour < prefs.quietEnd;
}

/** Business records commit before this optional, at-least-once delivery path runs. */
export class FinanceDeliveryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sender: FinancePushSender,
  ) {}

  async deliverDue(now = new Date(), signal: AbortSignal = new AbortController().signal) {
    const candidates = await this.prisma.financeNotification.findMany({
      where: {
        kind: { not: "integration.test" },
        readAt: null,
        pushStatus: { in: ["pending", "failed", "unavailable", "uncertain"] },
        nextPushAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      include: { user: { select: { financePreferences: true } } },
      orderBy: [{ nextPushAt: "asc" }, { id: "asc" }],
      take: 20,
    });
    for (const notification of candidates) {
      if (signal.aborted) return;
      const leaseToken = randomUUID();
      const claimed = await this.prisma.financeNotification.updateMany({
        where: {
          id: notification.id,
          readAt: null,
          pushStatus: { in: ["pending", "failed", "unavailable", "uncertain"] },
          nextPushAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        data: { leaseToken, leaseUntil: new Date(now.getTime() + 120_000) },
      });
      if (!claimed.count) continue;
      const prefs = notification.user.financePreferences ?? DEFAULT_INTELLIGENCE_PREFERENCES;
      const release = (data: { pushStatus?: string; nextPushAt?: Date }) =>
        this.prisma.financeNotification.updateMany({
          where: { id: notification.id, leaseToken },
          data: { ...data, leaseToken: null, leaseUntil: null },
        });
      if (!prefs.pushEnabled) {
        await release({ pushStatus: "muted" });
        continue;
      }
      if (
        notification.recordedAt.getTime() < now.getTime() - 86_400_000 ||
        notification.pushAttempts >= 5
      ) {
        await release({ pushStatus: "expired" });
        continue;
      }
      if (isFinanceQuietTime(now, prefs)) {
        await release({ nextPushAt: new Date(now.getTime() + 900_000) });
        continue;
      }
      if (!(await this.sender.hasPushRecipient(notification.userId))) {
        await release({
          pushStatus: "unavailable",
          nextPushAt: new Date(now.getTime() + 1_800_000),
        });
        continue;
      }
      // A process may have died after Expo accepted the previous send. Preserve
      // that uncertainty; the next send uses the same business collapse ID.
      const deliveryId = randomUUID();
      await this.prisma.$transaction(async (tx) => {
        await tx.financePushAttempt.updateMany({
          where: { notificationId: notification.id, status: "started" },
          data: { status: "uncertain", finishedAt: now },
        });
        await tx.financePushAttempt.create({
          data: { notificationId: notification.id, deliveryId, startedAt: now },
        });
        await tx.financeNotification.updateMany({
          where: { id: notification.id, leaseToken },
          data: { pushAttempts: { increment: 1 }, lastPushAt: now },
        });
      });
      let status: "accepted" | "unavailable" | "uncertain";
      try {
        status = await this.sender.deliverFinance(
          { id: notification.id, deliveryId, title: notification.title, body: notification.body },
          { userId: notification.userId, signal },
        );
      } catch {
        // Network failure may occur after remote acceptance. Never call it an
        // exactly-once failure or mark the business notification as delivered.
        status = "uncertain";
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.financePushAttempt.update({
          where: { deliveryId },
          data: { status, finishedAt: new Date() },
        });
        await tx.financeNotification.updateMany({
          where: { id: notification.id, leaseToken, readAt: null },
          data: {
            pushStatus: status,
            nextPushAt: new Date(
              now.getTime() +
                (status === "unavailable" ? 1_800_000 : 60_000 * 2 ** notification.pushAttempts),
            ),
            leaseToken: null,
            leaseUntil: null,
          },
        });
        // Reading during delivery wins, while the attempt still records the send.
        await tx.financeNotification.updateMany({
          where: { id: notification.id, leaseToken, readAt: { not: null } },
          data: { pushStatus: "read", leaseToken: null, leaseUntil: null },
        });
      });
    }
  }
}
