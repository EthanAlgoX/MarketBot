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

import { resolveConfigDir } from "../utils.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function upsertSharedEnvVar(params: {
  key: string;
  value: string;
  env?: NodeJS.ProcessEnv;
}): { path: string; updated: boolean; created: boolean } {
  const env = params.env ?? process.env;
  const dir = resolveConfigDir(env);
  const filepath = path.join(dir, ".env");
  const key = params.key.trim();
  const value = params.value;

  let raw = "";
  if (fs.existsSync(filepath)) {
    raw = fs.readFileSync(filepath, "utf8");
  }

  const lines = raw.length ? raw.split(/\r?\n/) : [];
  const matcher = new RegExp(`^(\\s*(?:export\\s+)?)${escapeRegExp(key)}\\s*=`);
  let updated = false;
  let replaced = false;

  const nextLines = lines.map((line) => {
    const match = line.match(matcher);
    if (!match) {
      return line;
    }
    replaced = true;
    const prefix = match[1] ?? "";
    const next = `${prefix}${key}=${value}`;
    if (next !== line) {
      updated = true;
    }
    return next;
  });

  if (!replaced) {
    nextLines.push(`${key}=${value}`);
    updated = true;
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const output = `${nextLines.join("\n")}\n`;
  fs.writeFileSync(filepath, output, "utf8");
  fs.chmodSync(filepath, 0o600);

  return { path: filepath, updated, created: !raw };
}
