#!/usr/bin/env node
import process from "node:process";
import "dotenv/config"; // Load environment variables
import { fileURLToPath } from "node:url";

import { buildProgram } from "./cli/program.js";

export { runMarketBot } from "./core/pipeline.js";
export { createProviderFromConfig } from "./core/providers/registry.js";
export type * from "./core/types.js";
export { getMarketDataFromIntent } from "./data/marketDataService.js";
export { loadDataConfig } from "./data/config.js";
export { createDefaultDeps } from "./cli/deps.js";
export { createDefaultToolRegistry } from "./tools/registry.js";
export { runSkillCommand } from "./skills/invocation.js";
export { toolsListCommand, toolsInfoCommand, toolsRunCommand } from "./cli/commands/tools.js";

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const program = buildProgram();
  void program.parseAsync(process.argv).catch((error) => {
    console.error("MarketBot CLI failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
