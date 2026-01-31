import type { ToolContext } from "./types.js";

export function buildToolContext(rawArgs: string, cwd: string = process.cwd(), agentId?: string): ToolContext {
  const trimmed = rawArgs.trim();
  const args = trimmed ? trimmed.split(/\s+/) : [];
  const json = safeJsonParse(trimmed);
  return {
    rawArgs: trimmed,
    args,
    json: json ?? undefined,
    cwd,
    env: process.env,
    agentId,
  };
}

function safeJsonParse(input: string): unknown | null {
  if (!input) return null;
  if (!(input.startsWith("{") || input.startsWith("["))) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}
