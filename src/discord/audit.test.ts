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

import { describe, expect, it, vi } from "vitest";

vi.mock("./send.js", () => ({
  fetchChannelPermissionsDiscord: vi.fn(),
}));

describe("discord audit", () => {
  it("collects numeric channel ids and counts unresolved keys", async () => {
    const { collectDiscordAuditChannelIds, auditDiscordChannelPermissions } =
      await import("./audit.js");
    const { fetchChannelPermissionsDiscord } = await import("./send.js");

    const cfg = {
      channels: {
        discord: {
          enabled: true,
          token: "t",
          groupPolicy: "allowlist",
          guilds: {
            "123": {
              channels: {
                "111": { allow: true },
                general: { allow: true },
                "222": { allow: false },
              },
            },
          },
        },
      },
    } as unknown as import("../config/config.js").MarketBotConfig;

    const collected = collectDiscordAuditChannelIds({
      cfg,
      accountId: "default",
    });
    expect(collected.channelIds).toEqual(["111"]);
    expect(collected.unresolvedChannels).toBe(1);

    (fetchChannelPermissionsDiscord as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      channelId: "111",
      permissions: ["ViewChannel"],
      raw: "0",
      isDm: false,
    });

    const audit = await auditDiscordChannelPermissions({
      token: "t",
      accountId: "default",
      channelIds: collected.channelIds,
      timeoutMs: 1000,
    });
    expect(audit.ok).toBe(false);
    expect(audit.channels[0]?.channelId).toBe("111");
    expect(audit.channels[0]?.missing).toContain("SendMessages");
  });
});
