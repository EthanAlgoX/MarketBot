import { FinanceDeliveryService, type FinancePushSender } from "@marketbot/adapters";
import type { PrismaClient } from "@marketbot/db";
import { getLogger } from "@marketbot/logging";

export function startFinanceDelivery(prisma: PrismaClient, sender: FinancePushSender) {
  const service = new FinanceDeliveryService(prisma, sender);
  const controller = new AbortController();
  let running: Promise<void> | undefined;
  function tick() {
    if (controller.signal.aborted || running) return;
    running = service
      .deliverDue(new Date(), controller.signal)
      .catch(() => getLogger().warn("financial notification delivery will retry"))
      .finally(() => {
        running = undefined;
      });
  }
  const timer = setInterval(tick, 30_000);
  timer.unref();
  tick();
  return {
    stop: async () => {
      clearInterval(timer);
      controller.abort();
      await running;
    },
  };
}
