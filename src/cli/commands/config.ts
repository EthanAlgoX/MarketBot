import fs from "node:fs/promises";

import { loadConfig } from "../../config/io.js";
import { resolveConfigPath } from "../../config/paths.js";
import { validateMarketBotConfig } from "../../config/schema.js";

export async function configShowCommand(): Promise<void> {
  const configPath = resolveConfigPath();
  try {
    const raw = await fs.readFile(configPath, "utf8");
    console.log(raw.trim());
  } catch {
    console.log("marketbot.json not found. Run `marketbot setup`.");
  }
}

export async function configValidateCommand(): Promise<void> {
  const config = await loadConfig(process.cwd(), { validate: true });
  validateMarketBotConfig(config);
  console.log("marketbot.json OK");
}
