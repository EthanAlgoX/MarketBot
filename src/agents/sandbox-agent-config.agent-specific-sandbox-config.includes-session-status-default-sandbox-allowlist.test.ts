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

import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketBotConfig } from "../config/config.js";

// We need to test the internal defaultSandboxConfig function, but it's not exported.
// Instead, we test the behavior through resolveSandboxContext which uses it.

type SpawnCall = {
  command: string;
  args: string[];
};

const spawnCalls: SpawnCall[] = [];

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: (command: string, args: string[]) => {
      spawnCalls.push({ command, args });
      const child = new EventEmitter() as {
        stdout?: Readable;
        stderr?: Readable;
        on: (event: string, cb: (...args: unknown[]) => void) => void;
      };
      child.stdout = new Readable({ read() {} });
      child.stderr = new Readable({ read() {} });

      const dockerArgs = command === "docker" ? args : [];
      const shouldFailContainerInspect =
        dockerArgs[0] === "inspect" &&
        dockerArgs[1] === "-f" &&
        dockerArgs[2] === "{{.State.Running}}";
      const shouldSucceedImageInspect = dockerArgs[0] === "image" && dockerArgs[1] === "inspect";

      const code = shouldFailContainerInspect ? 1 : 0;
      if (shouldSucceedImageInspect) {
        queueMicrotask(() => child.emit("close", 0));
      } else {
        queueMicrotask(() => child.emit("close", code));
      }
      return child;
    },
  };
});

describe("Agent-specific sandbox config", () => {
  beforeEach(() => {
    spawnCalls.length = 0;
  });

  it("includes session_status in default sandbox allowlist", async () => {
    const { resolveSandboxConfigForAgent } = await import("./sandbox.js");

    const cfg: MarketBotConfig = {
      agents: {
        defaults: {
          sandbox: {
            mode: "all",
            scope: "agent",
          },
        },
      },
    };

    const sandbox = resolveSandboxConfigForAgent(cfg, "main");
    expect(sandbox.tools.allow).toContain("session_status");
  });
  it("includes image in default sandbox allowlist", async () => {
    const { resolveSandboxConfigForAgent } = await import("./sandbox.js");

    const cfg: MarketBotConfig = {
      agents: {
        defaults: {
          sandbox: {
            mode: "all",
            scope: "agent",
          },
        },
      },
    };

    const sandbox = resolveSandboxConfigForAgent(cfg, "main");
    expect(sandbox.tools.allow).toContain("image");
  });
  it("injects image into explicit sandbox allowlists", async () => {
    const { resolveSandboxConfigForAgent } = await import("./sandbox.js");

    const cfg: MarketBotConfig = {
      tools: {
        sandbox: {
          tools: {
            allow: ["bash", "read"],
            deny: [],
          },
        },
      },
      agents: {
        defaults: {
          sandbox: {
            mode: "all",
            scope: "agent",
          },
        },
      },
    };

    const sandbox = resolveSandboxConfigForAgent(cfg, "main");
    expect(sandbox.tools.allow).toContain("image");
  });
});
