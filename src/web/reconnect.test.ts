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

import { describe, expect, it } from "vitest";

import type { MarketBotConfig } from "../config/config.js";
import {
  computeBackoff,
  DEFAULT_HEARTBEAT_SECONDS,
  DEFAULT_RECONNECT_POLICY,
  resolveHeartbeatSeconds,
  resolveReconnectPolicy,
  sleepWithAbort,
} from "./reconnect.js";

describe("web reconnect helpers", () => {
  const cfg: MarketBotConfig = {};

  it("resolves sane reconnect defaults with clamps", () => {
    const policy = resolveReconnectPolicy(cfg, {
      initialMs: 100,
      maxMs: 5,
      factor: 20,
      jitter: 2,
      maxAttempts: -1,
    });

    expect(policy.initialMs).toBe(250); // clamped to minimum
    expect(policy.maxMs).toBeGreaterThanOrEqual(policy.initialMs);
    expect(policy.factor).toBeLessThanOrEqual(10);
    expect(policy.jitter).toBeLessThanOrEqual(1);
    expect(policy.maxAttempts).toBeGreaterThanOrEqual(0);
  });

  it("computes increasing backoff with jitter", () => {
    const policy = { ...DEFAULT_RECONNECT_POLICY, jitter: 0 };
    const first = computeBackoff(policy, 1);
    const second = computeBackoff(policy, 2);
    expect(first).toBe(policy.initialMs);
    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThanOrEqual(policy.maxMs);
  });

  it("returns heartbeat default when unset", () => {
    expect(resolveHeartbeatSeconds(cfg)).toBe(DEFAULT_HEARTBEAT_SECONDS);
    expect(resolveHeartbeatSeconds(cfg, 5)).toBe(5);
  });

  it("sleepWithAbort rejects on abort", async () => {
    const controller = new AbortController();
    const promise = sleepWithAbort(50, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow("aborted");
  });
});
