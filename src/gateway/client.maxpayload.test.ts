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

import { describe, expect, test, vi } from "vitest";

describe("GatewayClient", () => {
  test("uses a large maxPayload for node snapshots", async () => {
    vi.resetModules();

    class MockWebSocket {
      static last: { url: unknown; opts: unknown } | null = null;

      on = vi.fn();
      close = vi.fn();
      send = vi.fn();

      constructor(url: unknown, opts: unknown) {
        MockWebSocket.last = { url, opts };
      }
    }

    vi.doMock("ws", () => ({
      WebSocket: MockWebSocket,
    }));

    const { GatewayClient } = await import("./client.js");
    const client = new GatewayClient({ url: "ws://127.0.0.1:1" });
    client.start();

    expect(MockWebSocket.last?.url).toBe("ws://127.0.0.1:1");
    expect(MockWebSocket.last?.opts).toEqual(
      expect.objectContaining({ maxPayload: 25 * 1024 * 1024 }),
    );
  });
});
