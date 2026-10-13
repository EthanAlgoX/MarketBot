// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { PrismaClient } from "@marketbot/db";

/**
 * Executor dep answering "does this bot belong to a messaging identity?" —
 * one indexed query per run, and none when the messaging surface is absent.
 */
export function createMessagingContextLoader(prisma: PrismaClient) {
  return {
    hasIdentity: async (botId: string): Promise<boolean> =>
      Boolean(
        await prisma.messagingIdentity.findUnique({ where: { botId }, select: { id: true } }),
      ),
  };
}
