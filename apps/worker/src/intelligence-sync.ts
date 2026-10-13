import { IntelligenceService } from "@marketbot/adapters";
import type { PrismaClient } from "@marketbot/db";
import { getLogger } from "@marketbot/logging";

export function startIntelligenceSync(prisma: PrismaClient) {
  const service = new IntelligenceService(prisma);
  let stopped = false;
  let running: Promise<void> | undefined;
  const controller = new AbortController();
  function tick() {
    if (stopped || running) return;
    running = (async () => {
      await service.syncDue(new Date(), controller.signal);
      if (!stopped) await service.publishDue();
    })()
      .catch(() => {
        getLogger().warn("intelligence sync failed; next cycle will retry");
      })
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
      controller.abort();
      clearInterval(timer);
      await running;
    },
  };
}
