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

import { parseTimeoutMs } from "./parse-timeout.js";

export function parseEnvPairs(pairs: unknown): Record<string, string> | undefined {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return undefined;
  }
  const env: Record<string, string> = {};
  for (const pair of pairs) {
    if (typeof pair !== "string") {
      continue;
    }
    const idx = pair.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = pair.slice(0, idx).trim();
    if (!key) {
      continue;
    }
    env[key] = pair.slice(idx + 1);
  }
  return Object.keys(env).length > 0 ? env : undefined;
}

export { parseTimeoutMs };
