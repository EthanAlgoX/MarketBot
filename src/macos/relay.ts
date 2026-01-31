#!/usr/bin/env node
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

import process from "node:process";

declare const __MARKETBOT_VERSION__: string | undefined;

const BUNDLED_VERSION =
  (typeof __MARKETBOT_VERSION__ === "string" && __MARKETBOT_VERSION__) ||
  process.env.MARKETBOT_BUNDLED_VERSION ||
  "0.0.0";

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

async function patchBunLongForProtobuf(): Promise<void> {
  // Bun ships a global `Long` that protobufjs detects, but it is not long.js and
  // misses critical APIs (fromBits, ...). Baileys WAProto expects long.js.
  if (typeof process.versions.bun !== "string") {
    return;
  }
  const mod = await import("long");
  const Long = (mod as unknown as { default?: unknown }).default ?? mod;
  (globalThis as unknown as { Long?: unknown }).Long = Long;
}

async function main() {
  const args = process.argv.slice(2);

  // Swift side expects `--version` to return a plain semver string.
  if (hasFlag(args, "--version") || hasFlag(args, "-V") || hasFlag(args, "-v")) {
    console.log(BUNDLED_VERSION);
    process.exit(0);
  }

  const { parseRelaySmokeTest, runRelaySmokeTest } = await import("./relay-smoke.js");
  const smokeTest = parseRelaySmokeTest(args, process.env);
  if (smokeTest) {
    try {
      await runRelaySmokeTest(smokeTest);
      process.exit(0);
    } catch (err) {
      console.error(`Relay smoke test failed (${smokeTest}):`, err);
      process.exit(1);
    }
  }

  await patchBunLongForProtobuf();

  const { loadDotEnv } = await import("../infra/dotenv.js");
  loadDotEnv({ quiet: true });

  const { ensureMarketBotCliOnPath } = await import("../infra/path-env.js");
  ensureMarketBotCliOnPath();

  const { enableConsoleCapture } = await import("../logging.js");
  enableConsoleCapture();

  const { assertSupportedRuntime } = await import("../infra/runtime-guard.js");
  assertSupportedRuntime();
  const { formatUncaughtError } = await import("../infra/errors.js");
  const { installUnhandledRejectionHandler } = await import("../infra/unhandled-rejections.js");

  const { buildProgram } = await import("../cli/program.js");
  const program = buildProgram();

  installUnhandledRejectionHandler();

  process.on("uncaughtException", (error) => {
    console.error("[marketbot] Uncaught exception:", formatUncaughtError(error));
    process.exit(1);
  });

  await program.parseAsync(process.argv);
}

void main().catch((err) => {
  console.error(
    "[marketbot] Relay failed:",
    err instanceof Error ? (err.stack ?? err.message) : err,
  );
  process.exit(1);
});
