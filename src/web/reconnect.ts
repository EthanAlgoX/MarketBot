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

import { randomUUID } from "node:crypto";

import type { MarketBotConfig } from "../config/config.js";
import type { BackoffPolicy } from "../infra/backoff.js";
import { computeBackoff, sleepWithAbort } from "../infra/backoff.js";

export type ReconnectPolicy = BackoffPolicy & {
  maxAttempts: number;
};

export const DEFAULT_HEARTBEAT_SECONDS = 60;
export const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
  initialMs: 2_000,
  maxMs: 30_000,
  factor: 1.8,
  jitter: 0.25,
  maxAttempts: 12,
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

export function resolveHeartbeatSeconds(cfg: MarketBotConfig, overrideSeconds?: number): number {
  const candidate = overrideSeconds ?? cfg.web?.heartbeatSeconds;
  if (typeof candidate === "number" && candidate > 0) {
    return candidate;
  }
  return DEFAULT_HEARTBEAT_SECONDS;
}

export function resolveReconnectPolicy(
  cfg: MarketBotConfig,
  overrides?: Partial<ReconnectPolicy>,
): ReconnectPolicy {
  const reconnectOverrides = cfg.web?.reconnect ?? {};
  const overrideConfig = overrides ?? {};
  const merged = {
    ...DEFAULT_RECONNECT_POLICY,
    ...reconnectOverrides,
    ...overrideConfig,
  } as ReconnectPolicy;

  merged.initialMs = Math.max(250, merged.initialMs);
  merged.maxMs = Math.max(merged.initialMs, merged.maxMs);
  merged.factor = clamp(merged.factor, 1.1, 10);
  merged.jitter = clamp(merged.jitter, 0, 1);
  merged.maxAttempts = Math.max(0, Math.floor(merged.maxAttempts));
  return merged;
}

export { computeBackoff, sleepWithAbort };

export function newConnectionId() {
  return randomUUID();
}
