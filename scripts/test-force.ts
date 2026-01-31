#!/usr/bin/env -S node --import tsx
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

import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { forceFreePort, type PortProcess } from "../src/cli/ports.js";

const DEFAULT_PORT = 18789;

function killGatewayListeners(port: number): PortProcess[] {
  try {
    const killed = forceFreePort(port);
    if (killed.length > 0) {
      console.log(
        `freed port ${port}; terminated: ${killed
          .map((p) => `${p.command} (pid ${p.pid})`)
          .join(", ")}`,
      );
    } else {
      console.log(`port ${port} already free`);
    }
    return killed;
  } catch (err) {
    console.error(`failed to free port ${port}: ${String(err)}`);
    return [];
  }
}

function runTests() {
  const isolatedLock =
    process.env.MARKETBOT_GATEWAY_LOCK ??
    path.join(os.tmpdir(), `marketbot-gateway.lock.test.${Date.now()}`);
  const result = spawnSync("pnpm", ["vitest", "run"], {
    stdio: "inherit",
    env: {
      ...process.env,
      MARKETBOT_GATEWAY_LOCK: isolatedLock,
    },
  });
  if (result.error) {
    console.error(`pnpm test failed to start: ${String(result.error)}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

function main() {
  const port = Number.parseInt(process.env.MARKETBOT_GATEWAY_PORT ?? `${DEFAULT_PORT}`, 10);

  console.log(`🧹 test:force - clearing gateway on port ${port}`);
  const killed = killGatewayListeners(port);
  if (killed.length === 0) {
    console.log("no listeners to kill");
  }

  console.log("running pnpm test…");
  runTests();
}

main();
