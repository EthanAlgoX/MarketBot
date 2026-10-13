import { isDeepStrictEqual } from "node:util";
import type { FinanceEventPage } from "@marketbot/contracts";
import type { PrismaClient } from "./client.js";
import { withTransactionRetry } from "./transaction-retry.js";

export class FinanceEventIntegrityError extends Error {}

/** Inbox, station notification, and cursor advance always commit together. */
export async function ingestFinanceEvents(
  prisma: PrismaClient,
  userId: string,
  issuer: string,
  page: FinanceEventPage,
): Promise<number> {
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`finance:${userId}`}, 0))::text AS "lock"`;
      const cursor = await tx.financeEventCursor.upsert({
        where: { userId },
        create: { userId, issuer, sequence: 0 },
        update: {},
      });
      if (cursor.issuer !== issuer || (cursor.streamId && cursor.streamId !== page.streamId)) {
        throw new FinanceEventIntegrityError(
          "Financial event stream changed; reconciliation required",
        );
      }
      let current = Number(cursor.sequence);
      if (!Number.isSafeInteger(current))
        throw new FinanceEventIntegrityError("Cursor exceeds supported range");
      if (page.after > current || (page.after === current && page.highWater < current)) {
        throw new FinanceEventIntegrityError("Financial restore is behind the assistant cursor");
      }
      let previous = page.after;
      let added = 0;
      for (const event of page.events) {
        if (event.sequence !== previous + 1 || event.sequence > page.highWater) {
          throw new FinanceEventIntegrityError("Non-contiguous committed financial events");
        }
        previous = event.sequence;
        if (event.sequence <= current) {
          const stored = await tx.financeEventInbox.findUnique({
            where: { userId_eventId: { userId, eventId: event.id } },
          });
          if (
            !stored ||
            stored.sequence !== BigInt(event.sequence) ||
            stored.streamId !== page.streamId ||
            !isDeepStrictEqual(stored.payload, event)
          ) {
            throw new FinanceEventIntegrityError("Event identity changed during replay");
          }
          continue;
        }
        if (event.sequence !== current + 1)
          throw new FinanceEventIntegrityError("Event gap requires reconciliation");
        await tx.financeEventInbox.create({
          data: {
            userId,
            eventId: event.id,
            streamId: page.streamId,
            sequence: event.sequence,
            kind: event.kind,
            recordedAt: new Date(event.recordedAt),
            payload: event,
          },
        });
        const content =
          event.kind === "integration.test"
            ? {
                title: "金融通道验证",
                body: "测试事件已接收。这条记录用于验证同步，不代表模拟成交。",
                pushStatus: "muted",
              }
            : event.payload.trades.length
              ? {
                  title: `模拟策略 · ${event.simulationDate}`,
                  body: `${event.payload.name}：${event.payload.trades.filter((trade) => trade.status === "filled").length} 笔模拟成交，${event.payload.trades.filter((trade) => trade.status === "rejected").length} 笔拒单。日线精度，现金 ${event.payload.cash} ${event.payload.currency}。`,
                  pushStatus: "pending",
                }
              : null;
        if (content)
          await tx.financeNotification.create({
            data: {
              userId,
              eventId: event.id,
              kind: event.kind,
              recordedAt: new Date(event.recordedAt),
              ...content,
            },
          });
        current = event.sequence;
        added++;
      }
      if (page.events.length === 0 && page.after === current && page.highWater > current) {
        throw new FinanceEventIntegrityError("Financial event history was truncated");
      }
      await tx.financeEventCursor.update({
        where: { userId },
        data: { streamId: page.streamId, sequence: current, status: "ready" },
      });
      return added;
    }),
  );
}
