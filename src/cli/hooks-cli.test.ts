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
import type { HookStatusReport } from "../hooks/hooks-status.js";
import { formatHooksCheck, formatHooksList } from "./hooks-cli.js";

const report: HookStatusReport = {
  workspaceDir: "/tmp/workspace",
  managedHooksDir: "/tmp/hooks",
  hooks: [
    {
      name: "session-memory",
      description: "Save session context to memory",
      source: "marketbot-bundled",
      pluginId: undefined,
      filePath: "/tmp/hooks/session-memory/HOOK.md",
      baseDir: "/tmp/hooks/session-memory",
      handlerPath: "/tmp/hooks/session-memory/handler.js",
      hookKey: "session-memory",
      emoji: "💾",
      homepage: "https://docs.marketbot.ai/hooks#session-memory",
      events: ["command:new"],
      always: false,
      disabled: false,
      eligible: true,
      managedByPlugin: false,
      requirements: {
        bins: [],
        anyBins: [],
        env: [],
        config: [],
        os: [],
      },
      missing: {
        bins: [],
        anyBins: [],
        env: [],
        config: [],
        os: [],
      },
      configChecks: [],
      install: [],
    },
  ],
};

describe("hooks cli formatting", () => {
  it("labels hooks list output", () => {
    const output = formatHooksList(report, {});
    expect(output).toContain("Hooks");
    expect(output).not.toContain("Internal Hooks");
  });

  it("labels hooks status output", () => {
    const output = formatHooksCheck(report, {});
    expect(output).toContain("Hooks Status");
  });

  it("labels plugin-managed hooks with plugin id", () => {
    const pluginReport: HookStatusReport = {
      workspaceDir: "/tmp/workspace",
      managedHooksDir: "/tmp/hooks",
      hooks: [
        {
          name: "plugin-hook",
          description: "Hook from plugin",
          source: "marketbot-plugin",
          pluginId: "voice-call",
          filePath: "/tmp/hooks/plugin-hook/HOOK.md",
          baseDir: "/tmp/hooks/plugin-hook",
          handlerPath: "/tmp/hooks/plugin-hook/handler.js",
          hookKey: "plugin-hook",
          emoji: "🔗",
          homepage: undefined,
          events: ["command:new"],
          always: false,
          disabled: false,
          eligible: true,
          managedByPlugin: true,
          requirements: {
            bins: [],
            anyBins: [],
            env: [],
            config: [],
            os: [],
          },
          missing: {
            bins: [],
            anyBins: [],
            env: [],
            config: [],
            os: [],
          },
          configChecks: [],
          install: [],
        },
      ],
    };

    const output = formatHooksList(pluginReport, {});
    expect(output).toContain("plugin:voice-call");
  });
});
