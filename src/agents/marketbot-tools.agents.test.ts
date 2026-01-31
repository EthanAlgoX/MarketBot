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

let configOverride: ReturnType<(typeof import("../config/config.js"))["loadConfig"]> = {
  session: {
    mainKey: "main",
    scope: "per-sender",
  },
};

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => configOverride,
    resolveGatewayPort: () => 18789,
  };
});

import "./test-helpers/fast-core-tools.js";
import { createMarketBotTools } from "./marketbot-tools.js";

describe("agents_list", () => {
  beforeEach(() => {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
    };
  });

  it("defaults to the requester agent only", async () => {
    const tool = createMarketBotTools({
      agentSessionKey: "main",
    }).find((candidate) => candidate.name === "agents_list");
    if (!tool) {
      throw new Error("missing agents_list tool");
    }

    const result = await tool.execute("call1", {});
    expect(result.details).toMatchObject({
      requester: "main",
      allowAny: false,
    });
    const agents = (result.details as { agents?: Array<{ id: string }> }).agents;
    expect(agents?.map((agent) => agent.id)).toEqual(["main"]);
  });

  it("includes allowlisted targets plus requester", async () => {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        list: [
          {
            id: "main",
            name: "Main",
            subagents: {
              allowAgents: ["research"],
            },
          },
          {
            id: "research",
            name: "Research",
          },
        ],
      },
    };

    const tool = createMarketBotTools({
      agentSessionKey: "main",
    }).find((candidate) => candidate.name === "agents_list");
    if (!tool) {
      throw new Error("missing agents_list tool");
    }

    const result = await tool.execute("call2", {});
    const agents = (
      result.details as {
        agents?: Array<{ id: string }>;
      }
    ).agents;
    expect(agents?.map((agent) => agent.id)).toEqual(["main", "research"]);
  });

  it("returns configured agents when allowlist is *", async () => {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        list: [
          {
            id: "main",
            subagents: {
              allowAgents: ["*"],
            },
          },
          {
            id: "research",
            name: "Research",
          },
          {
            id: "coder",
            name: "Coder",
          },
        ],
      },
    };

    const tool = createMarketBotTools({
      agentSessionKey: "main",
    }).find((candidate) => candidate.name === "agents_list");
    if (!tool) {
      throw new Error("missing agents_list tool");
    }

    const result = await tool.execute("call3", {});
    expect(result.details).toMatchObject({
      allowAny: true,
    });
    const agents = (
      result.details as {
        agents?: Array<{ id: string }>;
      }
    ).agents;
    expect(agents?.map((agent) => agent.id)).toEqual(["main", "coder", "research"]);
  });

  it("marks allowlisted-but-unconfigured agents", async () => {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        list: [
          {
            id: "main",
            subagents: {
              allowAgents: ["research"],
            },
          },
        ],
      },
    };

    const tool = createMarketBotTools({
      agentSessionKey: "main",
    }).find((candidate) => candidate.name === "agents_list");
    if (!tool) {
      throw new Error("missing agents_list tool");
    }

    const result = await tool.execute("call4", {});
    const agents = (
      result.details as {
        agents?: Array<{ id: string; configured: boolean }>;
      }
    ).agents;
    expect(agents?.map((agent) => agent.id)).toEqual(["main", "research"]);
    const research = agents?.find((agent) => agent.id === "research");
    expect(research?.configured).toBe(false);
  });
});
