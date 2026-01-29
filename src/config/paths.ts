import fs from "node:fs";
import path from "node:path";

export function resolveConfigPath(cwd: string = process.cwd()): string {
  const override = process.env.MARKETBOT_CONFIG_PATH?.trim() ?? process.env.TRADEBOT_CONFIG_PATH?.trim();
  if (override) return override;

  const marketbotPath = path.join(cwd, "marketbot.json");
  if (fs.existsSync(marketbotPath)) return marketbotPath;

  const tradebotPath = path.join(cwd, "tradebot.json");
  if (fs.existsSync(tradebotPath)) return tradebotPath;

  return marketbotPath;
}

export function resolveWorkspaceRoot(configPath: string): string {
  const base = path.basename(configPath);
  const workspaceName = base === "tradebot.json" ? "tradebot-workspace" : "marketbot-workspace";
  return path.join(path.dirname(configPath), workspaceName);
}
