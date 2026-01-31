/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { messagingApi } from "@line/bot-sdk";

export type LineReplyMessage = messagingApi.TextMessage;

export type SendLineReplyChunksParams = {
  to: string;
  chunks: string[];
  quickReplies?: string[];
  replyToken?: string | null;
  replyTokenUsed?: boolean;
  accountId?: string;
  replyMessageLine: (
    replyToken: string,
    messages: messagingApi.Message[],
    opts?: { accountId?: string },
  ) => Promise<unknown>;
  pushMessageLine: (to: string, text: string, opts?: { accountId?: string }) => Promise<unknown>;
  pushTextMessageWithQuickReplies: (
    to: string,
    text: string,
    quickReplies: string[],
    opts?: { accountId?: string },
  ) => Promise<unknown>;
  createTextMessageWithQuickReplies: (text: string, quickReplies: string[]) => LineReplyMessage;
  onReplyError?: (err: unknown) => void;
};

export async function sendLineReplyChunks(
  params: SendLineReplyChunksParams,
): Promise<{ replyTokenUsed: boolean }> {
  const hasQuickReplies = Boolean(params.quickReplies?.length);
  let replyTokenUsed = Boolean(params.replyTokenUsed);

  if (params.chunks.length === 0) {
    return { replyTokenUsed };
  }

  if (params.replyToken && !replyTokenUsed) {
    try {
      const replyBatch = params.chunks.slice(0, 5);
      const remaining = params.chunks.slice(replyBatch.length);

      const replyMessages: LineReplyMessage[] = replyBatch.map((chunk) => ({
        type: "text",
        text: chunk,
      }));

      if (hasQuickReplies && remaining.length === 0 && replyMessages.length > 0) {
        const lastIndex = replyMessages.length - 1;
        replyMessages[lastIndex] = params.createTextMessageWithQuickReplies(
          replyBatch[lastIndex],
          params.quickReplies!,
        );
      }

      await params.replyMessageLine(params.replyToken, replyMessages, {
        accountId: params.accountId,
      });
      replyTokenUsed = true;

      for (let i = 0; i < remaining.length; i += 1) {
        const isLastChunk = i === remaining.length - 1;
        if (isLastChunk && hasQuickReplies) {
          await params.pushTextMessageWithQuickReplies(
            params.to,
            remaining[i],
            params.quickReplies!,
            { accountId: params.accountId },
          );
        } else {
          await params.pushMessageLine(params.to, remaining[i], {
            accountId: params.accountId,
          });
        }
      }

      return { replyTokenUsed };
    } catch (err) {
      params.onReplyError?.(err);
      replyTokenUsed = true;
    }
  }

  for (let i = 0; i < params.chunks.length; i += 1) {
    const isLastChunk = i === params.chunks.length - 1;
    if (isLastChunk && hasQuickReplies) {
      await params.pushTextMessageWithQuickReplies(
        params.to,
        params.chunks[i],
        params.quickReplies!,
        { accountId: params.accountId },
      );
    } else {
      await params.pushMessageLine(params.to, params.chunks[i], {
        accountId: params.accountId,
      });
    }
  }

  return { replyTokenUsed };
}
