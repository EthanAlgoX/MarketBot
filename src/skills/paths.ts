import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { MarketBotConfig } from "../config/types.js";

export function resolveManagedSkillsDir(config?: MarketBotConfig): string {
  const envOverride =
    process.env.MARKETBOT_MANAGED_SKILLS_DIR?.trim() ?? process.env.TRADEBOT_MANAGED_SKILLS_DIR?.trim();
  if (envOverride) return envOverride;
  const cfgDir = config?.skills?.managedDir?.trim();
  if (cfgDir) return cfgDir;
  const marketbotDir = path.join(os.homedir(), ".marketbot", "skills");
  const tradebotDir = path.join(os.homedir(), ".tradebot", "skills");
  if (fs.existsSync(marketbotDir)) return marketbotDir;
  if (fs.existsSync(tradebotDir)) return tradebotDir;
  return marketbotDir;
}
