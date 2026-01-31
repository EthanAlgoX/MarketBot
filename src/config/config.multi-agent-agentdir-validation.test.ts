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

import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withTempHome } from "./test-helpers.js";

describe("multi-agent agentDir validation", () => {
  it("rejects shared agents.list agentDir", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const shared = path.join(tmpdir(), "marketbot-shared-agentdir");
    const res = validateConfigObject({
      agents: {
        list: [
          { id: "a", agentDir: shared },
          { id: "b", agentDir: shared },
        ],
      },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues.some((i) => i.path === "agents.list")).toBe(true);
      expect(res.issues[0]?.message).toContain("Duplicate agentDir");
    }
  });

  it("throws on shared agentDir during loadConfig()", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".marketbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "marketbot.json"),
        JSON.stringify(
          {
            agents: {
              list: [
                { id: "a", agentDir: "~/.marketbot/agents/shared/agent" },
                { id: "b", agentDir: "~/.marketbot/agents/shared/agent" },
              ],
            },
            bindings: [{ agentId: "a", match: { channel: "telegram" } }],
          },
          null,
          2,
        ),
        "utf-8",
      );

      vi.resetModules();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { loadConfig } = await import("./config.js");
      expect(() => loadConfig()).toThrow(/duplicate agentDir/i);
      expect(spy.mock.calls.flat().join(" ")).toMatch(/Duplicate agentDir/i);
      spy.mockRestore();
    });
  });
});
