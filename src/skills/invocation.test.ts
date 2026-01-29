import { describe, expect, it, vi } from "vitest";

import { runSkillCommand } from "./invocation.js";
import type { MarketBotConfig } from "../config/types.js";
import { ToolRegistry } from "../tools/registry.js";

describe("runSkillCommand", () => {
  it("routes to tool dispatch", async () => {
    const config: MarketBotConfig = {
      skills: {
        allowlist: ["chart-reader"],
      },
    };
    const skillModule = await import("./status.js");

    const registry = new ToolRegistry();
    registry.register({
      name: "chart_tool",
      description: "mock",
      run: async (ctx) => ({ ok: true, output: ctx.rawArgs }),
    });

    const spy = vi.spyOn(skillModule, "buildSkillStatus").mockResolvedValue({
      skills: [
        {
          name: "chart-reader",
          description: "Chart reader",
          emoji: undefined,
          filePath: "/tmp/chart-reader/SKILL.md",
          source: "managed",
          skillKey: "chart-reader",
          disabled: false,
          eligible: true,
          blockedByAllowlist: false,
          invocation: undefined,
          commands: [{ name: "analyze", description: undefined, dispatch: { kind: "tool", toolName: "chart_tool" } }],
          install: undefined,
          requirements: { bins: [], anyBins: [], env: [], os: [], config: [] },
          missing: { bins: [], anyBins: [], env: [], os: [], config: [] },
        },
      ],
      workspaceDir: "/tmp",
      managedSkillsDir: "/tmp",
    });

    const result = await runSkillCommand(config, {
      skill: "chart-reader",
      command: "analyze",
      rawArgs: "payload",
      registry,
      agentId: "main",
      cwd: process.cwd(),
    });

    expect(result.ok).toBe(true);
    expect(result.output).toBe("payload");
    spy.mockRestore();
  });
});
