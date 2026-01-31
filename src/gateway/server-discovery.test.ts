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

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getTailnetHostname = vi.hoisted(() => vi.fn());

vi.mock("../infra/tailscale.js", () => ({ getTailnetHostname }));

import { resolveTailnetDnsHint } from "./server-discovery.js";

describe("resolveTailnetDnsHint", () => {
  const prevTailnetDns = { value: undefined as string | undefined };

  beforeEach(() => {
    prevTailnetDns.value = process.env.MARKETBOT_TAILNET_DNS;
    delete process.env.MARKETBOT_TAILNET_DNS;
    getTailnetHostname.mockReset();
  });

  afterEach(() => {
    if (prevTailnetDns.value === undefined) {
      delete process.env.MARKETBOT_TAILNET_DNS;
    } else {
      process.env.MARKETBOT_TAILNET_DNS = prevTailnetDns.value;
    }
  });

  test("returns env hint when disabled", async () => {
    process.env.MARKETBOT_TAILNET_DNS = "studio.tailnet.ts.net.";
    const value = await resolveTailnetDnsHint({ enabled: false });
    expect(value).toBe("studio.tailnet.ts.net");
    expect(getTailnetHostname).not.toHaveBeenCalled();
  });

  test("skips tailscale lookup when disabled", async () => {
    const value = await resolveTailnetDnsHint({ enabled: false });
    expect(value).toBeUndefined();
    expect(getTailnetHostname).not.toHaveBeenCalled();
  });

  test("uses tailscale lookup when enabled", async () => {
    getTailnetHostname.mockResolvedValue("host.tailnet.ts.net");
    const value = await resolveTailnetDnsHint({ enabled: true });
    expect(value).toBe("host.tailnet.ts.net");
    expect(getTailnetHostname).toHaveBeenCalledTimes(1);
  });
});
