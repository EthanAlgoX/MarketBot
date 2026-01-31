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

import fs from "node:fs/promises";

import { resolveGatewayLogPaths } from "./launchd.js";

const GATEWAY_LOG_ERROR_PATTERNS = [
  /refusing to bind gateway/i,
  /gateway auth mode/i,
  /gateway start blocked/i,
  /failed to bind gateway socket/i,
  /tailscale .* requires/i,
];

async function readLastLogLine(filePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const lines = raw.split(/\r?\n/).map((line) => line.trim());
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (lines[i]) {
        return lines[i];
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function readLastGatewayErrorLine(env: NodeJS.ProcessEnv): Promise<string | null> {
  const { stdoutPath, stderrPath } = resolveGatewayLogPaths(env);
  const stderrRaw = await fs.readFile(stderrPath, "utf8").catch(() => "");
  const stdoutRaw = await fs.readFile(stdoutPath, "utf8").catch(() => "");
  const lines = [...stderrRaw.split(/\r?\n/), ...stdoutRaw.split(/\r?\n/)].map((line) =>
    line.trim(),
  );
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    if (GATEWAY_LOG_ERROR_PATTERNS.some((pattern) => pattern.test(line))) {
      return line;
    }
  }
  return (await readLastLogLine(stderrPath)) ?? (await readLastLogLine(stdoutPath));
}
