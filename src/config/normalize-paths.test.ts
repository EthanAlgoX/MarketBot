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

import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { withTempHome } from "../../test/helpers/temp-home.js";

describe("normalizeConfigPaths", () => {
  it("expands tilde for path-ish keys only", async () => {
    await withTempHome(async (home) => {
      vi.resetModules();
      const { normalizeConfigPaths } = await import("./normalize-paths.js");

      const cfg = normalizeConfigPaths({
        tools: { exec: { pathPrepend: ["~/bin"] } },
        plugins: { load: { paths: ["~/plugins/a"] } },
        logging: { file: "~/.marketbot/logs/marketbot.log" },
        hooks: {
          path: "~/.marketbot/hooks.json5",
          transformsDir: "~/hooks-xform",
        },
        channels: {
          telegram: {
            accounts: {
              personal: {
                tokenFile: "~/.marketbot/telegram.token",
              },
            },
          },
          imessage: {
            accounts: { personal: { dbPath: "~/Library/Messages/chat.db" } },
          },
        },
        agents: {
          defaults: { workspace: "~/ws-default" },
          list: [
            {
              id: "main",
              workspace: "~/ws-agent",
              agentDir: "~/.marketbot/agents/main",
              identity: {
                name: "~not-a-path",
              },
              sandbox: { workspaceRoot: "~/sandbox-root" },
            },
          ],
        },
      });

      expect(cfg.plugins?.load?.paths?.[0]).toBe(path.join(home, "plugins", "a"));
      expect(cfg.logging?.file).toBe(path.join(home, ".marketbot", "logs", "marketbot.log"));
      expect(cfg.hooks?.path).toBe(path.join(home, ".marketbot", "hooks.json5"));
      expect(cfg.hooks?.transformsDir).toBe(path.join(home, "hooks-xform"));
      expect(cfg.tools?.exec?.pathPrepend?.[0]).toBe(path.join(home, "bin"));
      expect(cfg.channels?.telegram?.accounts?.personal?.tokenFile).toBe(
        path.join(home, ".marketbot", "telegram.token"),
      );
      expect(cfg.channels?.imessage?.accounts?.personal?.dbPath).toBe(
        path.join(home, "Library", "Messages", "chat.db"),
      );
      expect(cfg.agents?.defaults?.workspace).toBe(path.join(home, "ws-default"));
      expect(cfg.agents?.list?.[0]?.workspace).toBe(path.join(home, "ws-agent"));
      expect(cfg.agents?.list?.[0]?.agentDir).toBe(path.join(home, ".marketbot", "agents", "main"));
      expect(cfg.agents?.list?.[0]?.sandbox?.workspaceRoot).toBe(path.join(home, "sandbox-root"));

      // Non-path key => do not treat "~" as home expansion.
      expect(cfg.agents?.list?.[0]?.identity?.name).toBe("~not-a-path");
    });
  });
});
