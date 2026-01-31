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

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { MarketBotConfig } from "../config/config.js";
import type { ExecApprovalsResolved } from "../infra/exec-approvals.js";
import { createMarketBotCodingTools } from "./pi-tools.js";

vi.mock("../infra/exec-approvals.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../infra/exec-approvals.js")>();
  const approvals: ExecApprovalsResolved = {
    path: "/tmp/exec-approvals.json",
    socketPath: "/tmp/exec-approvals.sock",
    token: "token",
    defaults: {
      security: "allowlist",
      ask: "off",
      askFallback: "deny",
      autoAllowSkills: false,
    },
    agent: {
      security: "allowlist",
      ask: "off",
      askFallback: "deny",
      autoAllowSkills: false,
    },
    allowlist: [],
    file: {
      version: 1,
      socket: { path: "/tmp/exec-approvals.sock", token: "token" },
      defaults: {
        security: "allowlist",
        ask: "off",
        askFallback: "deny",
        autoAllowSkills: false,
      },
      agents: {},
    },
  };
  return { ...mod, resolveExecApprovals: () => approvals };
});

describe("createMarketBotCodingTools safeBins", () => {
  it("threads tools.exec.safeBins into exec allowlist checks", async () => {
    if (process.platform === "win32") {
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "marketbot-safe-bins-"));
    const cfg: MarketBotConfig = {
      tools: {
        exec: {
          host: "gateway",
          security: "allowlist",
          ask: "off",
          safeBins: ["echo"],
        },
      },
    };

    const tools = createMarketBotCodingTools({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir: tmpDir,
      agentDir: path.join(tmpDir, "agent"),
    });
    const execTool = tools.find((tool) => tool.name === "exec");
    expect(execTool).toBeDefined();

    const marker = `safe-bins-${Date.now()}`;
    const result = await execTool!.execute("call1", {
      command: `echo ${marker}`,
      workdir: tmpDir,
    });
    const text = result.content.find((content) => content.type === "text")?.text ?? "";

    expect(result.details.status).toBe("completed");
    expect(text).toContain(marker);
  });
});
