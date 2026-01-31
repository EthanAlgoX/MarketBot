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

import { resolveStateDir } from "../config/paths.js";
import { isTruthyEnvValue } from "../infra/env.js";

const RAW_STREAM_ENABLED = isTruthyEnvValue(process.env.MARKETBOT_RAW_STREAM);
const RAW_STREAM_PATH =
  process.env.MARKETBOT_RAW_STREAM_PATH?.trim() ||
  path.join(resolveStateDir(), "logs", "raw-stream.jsonl");

let rawStreamReady = false;

export function appendRawStream(payload: Record<string, unknown>) {
  if (!RAW_STREAM_ENABLED) {
    return;
  }
  if (!rawStreamReady) {
    rawStreamReady = true;
    try {
      fs.mkdirSync(path.dirname(RAW_STREAM_PATH), { recursive: true });
    } catch {
      // ignore raw stream mkdir failures
    }
  }
  try {
    void fs.promises.appendFile(RAW_STREAM_PATH, `${JSON.stringify(payload)}\n`);
  } catch {
    // ignore raw stream write failures
  }
}
