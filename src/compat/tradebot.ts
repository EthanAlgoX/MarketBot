#!/usr/bin/env node
import process from "node:process";

import { buildProgram } from "../cli/program.js";

console.warn("tradebot is deprecated; use marketbot instead.");

const program = buildProgram();
void program.parseAsync(process.argv).catch((error) => {
  console.error("MarketBot CLI failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
