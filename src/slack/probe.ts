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

import { createSlackWebClient } from "./client.js";

export type SlackProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs?: number | null;
  bot?: { id?: string; name?: string };
  team?: { id?: string; name?: string };
};

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

export async function probeSlack(token: string, timeoutMs = 2500): Promise<SlackProbe> {
  const client = createSlackWebClient(token);
  const start = Date.now();
  try {
    const result = await withTimeout(client.auth.test(), timeoutMs);
    if (!result.ok) {
      return {
        ok: false,
        status: 200,
        error: result.error ?? "unknown",
        elapsedMs: Date.now() - start,
      };
    }
    return {
      ok: true,
      status: 200,
      elapsedMs: Date.now() - start,
      bot: { id: result.user_id ?? undefined, name: result.user ?? undefined },
      team: { id: result.team_id ?? undefined, name: result.team ?? undefined },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      typeof (err as { status?: number }).status === "number"
        ? (err as { status?: number }).status
        : null;
    return {
      ok: false,
      status,
      error: message,
      elapsedMs: Date.now() - start,
    };
  }
}
