// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { Actor, MessageBlock } from "@marketbot/contracts";
import type { Prisma, PrismaClient, ThreadEvents } from "@marketbot/db";
import { appendEventInTransaction, IsolationError } from "@marketbot/db";

/** Minimal dependency surface for helpers that update a bot's thread cards. */
export type BotThreadDeps = {
  prisma: PrismaClient;
  events: ThreadEvents;
};

export async function requireBotThread(deps: BotThreadDeps, actor: Actor, botId: string) {
  const bot = await deps.prisma.bot.findFirst({
    where: { id: botId, spaceId: actor.spaceId, userId: actor.userId },
    include: { thread: true },
  });
  if (!bot?.thread) throw new IsolationError();
  return { bot, thread: bot.thread };
}

export async function updateBlocks(
  deps: BotThreadDeps,
  target: { spaceId: string; botId: string; threadId: string },
  messageId: string,
  blocks: MessageBlock[],
): Promise<void> {
  const event = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.message.update({ where: { id: messageId }, data: { blocks } });
    return appendEventInTransaction(tx, {
      spaceId: target.spaceId,
      threadId: target.threadId,
      botId: target.botId,
      type: "thread.message.updated",
      payload: { messageId, role: "bot", blocks },
    });
  });
  await deps.events.notify(target.threadId, event.seq);
}
