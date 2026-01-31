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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getChannelActivity,
  recordChannelActivity,
  resetChannelActivityForTest,
} from "./channel-activity.js";

describe("channel activity", () => {
  beforeEach(() => {
    resetChannelActivityForTest();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-08T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records inbound/outbound separately", () => {
    recordChannelActivity({ channel: "telegram", direction: "inbound" });
    vi.advanceTimersByTime(1000);
    recordChannelActivity({ channel: "telegram", direction: "outbound" });
    const res = getChannelActivity({ channel: "telegram" });
    expect(res.inboundAt).toBe(1767830400000);
    expect(res.outboundAt).toBe(1767830401000);
  });

  it("isolates accounts", () => {
    recordChannelActivity({
      channel: "whatsapp",
      accountId: "a",
      direction: "inbound",
      at: 1,
    });
    recordChannelActivity({
      channel: "whatsapp",
      accountId: "b",
      direction: "inbound",
      at: 2,
    });
    expect(getChannelActivity({ channel: "whatsapp", accountId: "a" })).toEqual({
      inboundAt: 1,
      outboundAt: null,
    });
    expect(getChannelActivity({ channel: "whatsapp", accountId: "b" })).toEqual({
      inboundAt: 2,
      outboundAt: null,
    });
  });
});
