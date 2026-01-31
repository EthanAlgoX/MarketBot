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

import os from "node:os";

import { describe, expect, it, vi } from "vitest";

import { listTailnetAddresses } from "./tailnet.js";

describe("tailnet address detection", () => {
  it("detects tailscale IPv4 and IPv6 addresses", () => {
    vi.spyOn(os, "networkInterfaces").mockReturnValue({
      lo0: [
        { address: "127.0.0.1", family: "IPv4", internal: true, netmask: "" },
      ] as unknown as os.NetworkInterfaceInfo[],
      utun9: [
        {
          address: "100.123.224.76",
          family: "IPv4",
          internal: false,
          netmask: "",
        },
        {
          address: "fd7a:115c:a1e0::8801:e04c",
          family: "IPv6",
          internal: false,
          netmask: "",
        },
      ] as unknown as os.NetworkInterfaceInfo[],
    });

    const out = listTailnetAddresses();
    expect(out.ipv4).toEqual(["100.123.224.76"]);
    expect(out.ipv6).toEqual(["fd7a:115c:a1e0::8801:e04c"]);
  });
});
