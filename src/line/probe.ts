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

import { messagingApi } from "@line/bot-sdk";
import type { LineProbeResult } from "./types.js";

export async function probeLineBot(
  channelAccessToken: string,
  timeoutMs = 5000,
): Promise<LineProbeResult> {
  if (!channelAccessToken?.trim()) {
    return { ok: false, error: "Channel access token not configured" };
  }

  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: channelAccessToken.trim(),
  });

  try {
    const profile = await withTimeout(client.getBotInfo(), timeoutMs);

    return {
      ok: true,
      bot: {
        displayName: profile.displayName,
        userId: profile.userId,
        basicId: profile.basicId,
        pictureUrl: profile.pictureUrl,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}
