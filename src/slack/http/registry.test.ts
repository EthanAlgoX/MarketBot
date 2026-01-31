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

import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  handleSlackHttpRequest,
  normalizeSlackWebhookPath,
  registerSlackHttpHandler,
} from "./registry.js";

describe("normalizeSlackWebhookPath", () => {
  it("returns the default path when input is empty", () => {
    expect(normalizeSlackWebhookPath()).toBe("/slack/events");
    expect(normalizeSlackWebhookPath(" ")).toBe("/slack/events");
  });

  it("ensures a leading slash", () => {
    expect(normalizeSlackWebhookPath("slack/events")).toBe("/slack/events");
    expect(normalizeSlackWebhookPath("/hooks/slack")).toBe("/hooks/slack");
  });
});

describe("registerSlackHttpHandler", () => {
  const unregisters: Array<() => void> = [];

  afterEach(() => {
    for (const unregister of unregisters.splice(0)) {
      unregister();
    }
  });

  it("routes requests to a registered handler", async () => {
    const handler = vi.fn();
    unregisters.push(
      registerSlackHttpHandler({
        path: "/slack/events",
        handler,
      }),
    );

    const req = { url: "/slack/events?foo=bar" } as IncomingMessage;
    const res = {} as ServerResponse;

    const handled = await handleSlackHttpRequest(req, res);

    expect(handled).toBe(true);
    expect(handler).toHaveBeenCalledWith(req, res);
  });

  it("returns false when no handler matches", async () => {
    const req = { url: "/slack/other" } as IncomingMessage;
    const res = {} as ServerResponse;

    const handled = await handleSlackHttpRequest(req, res);

    expect(handled).toBe(false);
  });

  it("logs and ignores duplicate registrations", async () => {
    const handler = vi.fn();
    const log = vi.fn();
    unregisters.push(
      registerSlackHttpHandler({
        path: "/slack/events",
        handler,
        log,
        accountId: "primary",
      }),
    );
    unregisters.push(
      registerSlackHttpHandler({
        path: "/slack/events",
        handler: vi.fn(),
        log,
        accountId: "duplicate",
      }),
    );

    const req = { url: "/slack/events" } as IncomingMessage;
    const res = {} as ServerResponse;

    const handled = await handleSlackHttpRequest(req, res);

    expect(handled).toBe(true);
    expect(handler).toHaveBeenCalledWith(req, res);
    expect(log).toHaveBeenCalledWith(
      'slack: webhook path /slack/events already registered for account "duplicate"',
    );
  });
});
