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

import { signalCheck, signalRpcRequest } from "./client.js";

export type SignalProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs: number;
  version?: string | null;
};

function parseSignalVersion(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "object" && value !== null) {
    const version = (value as { version?: unknown }).version;
    if (typeof version === "string" && version.trim()) {
      return version.trim();
    }
  }
  return null;
}

export async function probeSignal(baseUrl: string, timeoutMs: number): Promise<SignalProbe> {
  const started = Date.now();
  const result: SignalProbe = {
    ok: false,
    status: null,
    error: null,
    elapsedMs: 0,
    version: null,
  };
  const check = await signalCheck(baseUrl, timeoutMs);
  if (!check.ok) {
    return {
      ...result,
      status: check.status ?? null,
      error: check.error ?? "unreachable",
      elapsedMs: Date.now() - started,
    };
  }
  try {
    const version = await signalRpcRequest("version", undefined, {
      baseUrl,
      timeoutMs,
    });
    result.version = parseSignalVersion(version);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return {
    ...result,
    ok: true,
    status: check.status ?? null,
    elapsedMs: Date.now() - started,
  };
}
