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

import { beforeEach, describe, expect, it, vi } from "vitest";

import { callGatewayTool, resolveGatewayOptions } from "./gateway.js";

const callGatewayMock = vi.fn();
vi.mock("../../gateway/call.js", () => ({
  callGateway: (...args: unknown[]) => callGatewayMock(...args),
}));

describe("gateway tool defaults", () => {
  beforeEach(() => {
    callGatewayMock.mockReset();
  });

  it("leaves url undefined so callGateway can use config", () => {
    const opts = resolveGatewayOptions();
    expect(opts.url).toBeUndefined();
  });

  it("passes through explicit overrides", async () => {
    callGatewayMock.mockResolvedValueOnce({ ok: true });
    await callGatewayTool(
      "health",
      { gatewayUrl: "ws://example", gatewayToken: "t", timeoutMs: 5000 },
      {},
    );
    expect(callGatewayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "ws://example",
        token: "t",
        timeoutMs: 5000,
      }),
    );
  });
});
