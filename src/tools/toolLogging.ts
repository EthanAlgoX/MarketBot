import fs from "node:fs/promises";
import path from "node:path";

import type { ToolContext } from "./types.js";
import { loadConfig } from "../config/io.js";
import { resolveAgentWorkspaceDir } from "../agents/agentScope.js";

export type ToolLogEntry = {
  ts: string;
  name: string;
  ok: boolean;
  durationMs: number;
  input?: string;
  output?: string;
  error?: string;
};

export async function appendToolLog(entry: Omit<ToolLogEntry, "ts">, context: ToolContext): Promise<void> {
  try {
    const config = await loadConfig(context.cwd, { validate: true });
    const agentId = context.agentId ?? "main";
    const workspaceDir = resolveAgentWorkspaceDir(config, agentId, context.cwd);
    const logsDir = path.join(workspaceDir, "logs");
    const filePath = path.join(logsDir, "tools.log.jsonl");

    await fs.mkdir(logsDir, { recursive: true });

    const payload: ToolLogEntry = {
      ts: new Date().toISOString(),
      ...entry,
    };

    const line = JSON.stringify(payload);
    await fs.appendFile(filePath, `${line}\n`, "utf8");
  } catch {
    // Ignore logging errors to avoid breaking tool execution
  }
}
