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

import fs from "node:fs";
import path from "node:path";
import { getTailnetHostname } from "../infra/tailscale.js";
import { runExec } from "../process/exec.js";

export type ResolveBonjourCliPathOptions = {
  env?: NodeJS.ProcessEnv;
  argv?: string[];
  execPath?: string;
  cwd?: string;
  statSync?: (path: string) => fs.Stats;
};

export function formatBonjourInstanceName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "MarketBot";
  }
  if (/marketbot/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} (MarketBot)`;
}

export function resolveBonjourCliPath(opts: ResolveBonjourCliPathOptions = {}): string | undefined {
  const env = opts.env ?? process.env;
  const envPath = env.MARKETBOT_CLI_PATH?.trim();
  if (envPath) {
    return envPath;
  }

  const statSync = opts.statSync ?? fs.statSync;
  const isFile = (candidate: string) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  };

  const execPath = opts.execPath ?? process.execPath;
  const execDir = path.dirname(execPath);
  const siblingCli = path.join(execDir, "marketbot");
  if (isFile(siblingCli)) {
    return siblingCli;
  }

  const argv = opts.argv ?? process.argv;
  const argvPath = argv[1];
  if (argvPath && isFile(argvPath)) {
    return argvPath;
  }

  const cwd = opts.cwd ?? process.cwd();
  const distCli = path.join(cwd, "dist", "index.js");
  if (isFile(distCli)) {
    return distCli;
  }
  const binCli = path.join(cwd, "bin", "marketbot");
  if (isFile(binCli)) {
    return binCli;
  }

  return undefined;
}

export async function resolveTailnetDnsHint(opts?: {
  env?: NodeJS.ProcessEnv;
  exec?: typeof runExec;
  enabled?: boolean;
}): Promise<string | undefined> {
  const env = opts?.env ?? process.env;
  const envRaw = env.MARKETBOT_TAILNET_DNS?.trim();
  const envValue = envRaw && envRaw.length > 0 ? envRaw.replace(/\.$/, "") : "";
  if (envValue) {
    return envValue;
  }
  if (opts?.enabled === false) {
    return undefined;
  }

  const exec =
    opts?.exec ??
    ((command, args) => runExec(command, args, { timeoutMs: 1500, maxBuffer: 200_000 }));
  try {
    return await getTailnetHostname(exec);
  } catch {
    return undefined;
  }
}
