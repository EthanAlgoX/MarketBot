import os from "node:os";
import path from "node:path";

export function resolveStateDir(): string {
  const override = process.env.MARKETBOT_STATE_DIR?.trim() ?? process.env.TRADEBOT_STATE_DIR?.trim();
  if (override) return override;
  return path.join(os.homedir(), ".marketbot");
}

export function resolveSessionsDir(stateDir: string, agentId: string): string {
  return path.join(stateDir, "agents", agentId, "sessions");
}

export function resolveSessionsIndexPath(sessionsDir: string): string {
  return path.join(sessionsDir, "sessions.json");
}

export function resolveSessionPath(sessionsDir: string, sessionId: string): string {
  return path.join(sessionsDir, `${sessionId}.jsonl`);
}
