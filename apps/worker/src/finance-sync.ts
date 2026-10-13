import { FinanceBridgeClient, resolveFinanceBridgeConfig } from "@marketbot/core";
import type { PrismaClient } from "@marketbot/db";
import { FinanceEventIntegrityError, ingestFinanceEvents } from "@marketbot/db";
import { getLogger } from "@marketbot/logging";

/** The worker consumes committed events; it never advances a financial strategy. */
export function startFinanceSync(prisma: PrismaClient, source = process.env) {
  const config = resolveFinanceBridgeConfig(source);
  if (!config) return { stop: async () => undefined };
  const issuer = config.issuer;
  const bridge = new FinanceBridgeClient(config);
  let stopped = false;
  let running: Promise<void> | undefined;
  async function poll() {
    let afterId: string | undefined;
    for (;;) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { financeCursor: { isNot: null } },
            { sessions: { some: { expiresAt: { gt: new Date() } } } },
          ],
        },
        select: { id: true, financeCursor: true },
        orderBy: { id: "asc" },
        take: 100,
        ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
      });
      for (const user of users) {
        if (stopped) return;
        if (user.financeCursor?.status === "recovery_required") continue;
        try {
          const page = await bridge.events(user.id, Number(user.financeCursor?.sequence ?? 0));
          await ingestFinanceEvents(prisma, user.id, issuer, page);
        } catch (error) {
          const recovery =
            error instanceof FinanceEventIntegrityError ||
            (error instanceof Error && "code" in error && error.code === "recovery_required");
          await prisma.financeEventCursor.updateMany({
            where: { userId: user.id },
            data: { status: recovery ? "recovery_required" : "unavailable" },
          });
        }
      }
      if (users.length < 100 || stopped) return;
      afterId = users[users.length - 1]?.id;
    }
  }
  function tick() {
    if (stopped || running) return;
    // A transient DB outage retries next cycle; no unhandled process rejection.
    running = poll()
      .catch(() => getLogger().warn("financial event sync failed; committed cursor is retained"))
      .finally(() => {
        running = undefined;
      });
  }
  const timer = setInterval(tick, 30_000);
  timer.unref();
  tick();
  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await running;
    },
  };
}
