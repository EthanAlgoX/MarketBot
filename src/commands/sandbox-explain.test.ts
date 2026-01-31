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

let mockCfg: unknown = {};

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: vi.fn().mockImplementation(() => mockCfg),
  };
});

describe("sandbox explain command", () => {
  it("prints JSON shape + fix-it keys", async () => {
    mockCfg = {
      agents: {
        defaults: {
          sandbox: { mode: "all", scope: "agent", workspaceAccess: "none" },
        },
      },
      tools: {
        sandbox: { tools: { deny: ["browser"] } },
        elevated: { enabled: true, allowFrom: { whatsapp: ["*"] } },
      },
      session: { store: "/tmp/marketbot-test-sessions-{agentId}.json" },
    };

    const { sandboxExplainCommand } = await import("./sandbox-explain.js");

    const logs: string[] = [];
    await sandboxExplainCommand({ json: true, session: "agent:main:main" }, {
      log: (msg: string) => logs.push(msg),
      error: (msg: string) => logs.push(msg),
      exit: (_code: number) => {},
    } as unknown as Parameters<typeof sandboxExplainCommand>[1]);

    const out = logs.join("");
    const parsed = JSON.parse(out);
    expect(parsed).toHaveProperty("docsUrl", "https://docs.marketbot.ai/sandbox");
    expect(parsed).toHaveProperty("sandbox.mode", "all");
    expect(parsed).toHaveProperty("sandbox.tools.sources.allow.source");
    expect(Array.isArray(parsed.fixIt)).toBe(true);
    expect(parsed.fixIt).toContain("agents.defaults.sandbox.mode=off");
    expect(parsed.fixIt).toContain("tools.sandbox.tools.deny");
  }, 15_000);
});
