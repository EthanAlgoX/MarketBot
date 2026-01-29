import fs from "node:fs/promises";

import type { MarketBotConfig } from "./types.js";
import { resolveConfigPath } from "./paths.js";
import { validateMarketBotConfig } from "./schema.js";

export async function loadConfig(
  cwd: string = process.cwd(),
  options?: { validate?: boolean },
): Promise<MarketBotConfig> {
  const configPath = resolveConfigPath(cwd);
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as MarketBotConfig;
    if (options?.validate) return validateMarketBotConfig(parsed) as MarketBotConfig;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function writeConfig(config: MarketBotConfig, cwd: string = process.cwd()): Promise<string> {
  const configPath = resolveConfigPath(cwd);
  const payload = JSON.stringify(config, null, 2);
  await fs.writeFile(configPath, payload, "utf8");
  return configPath;
}

export async function ensureConfig(config: MarketBotConfig, cwd: string = process.cwd()): Promise<string> {
  const configPath = resolveConfigPath(cwd);
  try {
    await fs.access(configPath);
    return configPath;
  } catch {
    return writeConfig(config, cwd);
  }
}
