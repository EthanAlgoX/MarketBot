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
import { listChannelPlugins } from "../../channels/plugins/index.js";
import { parseLogLine } from "../../logging/parse-log-line.js";
import { getResolvedLoggerSettings } from "../../logging.js";
import { defaultRuntime, type RuntimeEnv } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";

export type ChannelsLogsOptions = {
  channel?: string;
  lines?: string | number;
  json?: boolean;
};

type LogLine = ReturnType<typeof parseLogLine>;

const DEFAULT_LIMIT = 200;
const MAX_BYTES = 1_000_000;

const getChannelSet = () =>
  new Set<string>([...listChannelPlugins().map((plugin) => plugin.id), "all"]);

function parseChannelFilter(raw?: string) {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) {
    return "all";
  }
  return getChannelSet().has(trimmed) ? trimmed : "all";
}

function matchesChannel(line: NonNullable<LogLine>, channel: string) {
  if (channel === "all") {
    return true;
  }
  const needle = `gateway/channels/${channel}`;
  if (line.subsystem?.includes(needle)) {
    return true;
  }
  if (line.module?.includes(channel)) {
    return true;
  }
  return false;
}

async function readTailLines(file: string, limit: number): Promise<string[]> {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat) {
    return [];
  }
  const size = stat.size;
  const start = Math.max(0, size - MAX_BYTES);
  const handle = await fs.open(file, "r");
  try {
    const length = Math.max(0, size - start);
    if (length === 0) {
      return [];
    }
    const buffer = Buffer.alloc(length);
    const readResult = await handle.read(buffer, 0, length, start);
    const text = buffer.toString("utf8", 0, readResult.bytesRead);
    let lines = text.split("\n");
    if (start > 0) {
      lines = lines.slice(1);
    }
    if (lines.length && lines[lines.length - 1] === "") {
      lines = lines.slice(0, -1);
    }
    if (lines.length > limit) {
      lines = lines.slice(lines.length - limit);
    }
    return lines;
  } finally {
    await handle.close();
  }
}

export async function channelsLogsCommand(
  opts: ChannelsLogsOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const channel = parseChannelFilter(opts.channel);
  const limitRaw = typeof opts.lines === "string" ? Number(opts.lines) : opts.lines;
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.floor(limitRaw)
      : DEFAULT_LIMIT;

  const file = getResolvedLoggerSettings().file;
  const rawLines = await readTailLines(file, limit * 4);
  const parsed = rawLines
    .map(parseLogLine)
    .filter((line): line is NonNullable<LogLine> => Boolean(line));
  const filtered = parsed.filter((line) => matchesChannel(line, channel));
  const lines = filtered.slice(Math.max(0, filtered.length - limit));

  if (opts.json) {
    runtime.log(JSON.stringify({ file, channel, lines }, null, 2));
    return;
  }

  runtime.log(theme.info(`Log file: ${file}`));
  if (channel !== "all") {
    runtime.log(theme.info(`Channel: ${channel}`));
  }
  if (lines.length === 0) {
    runtime.log(theme.muted("No matching log lines."));
    return;
  }
  for (const line of lines) {
    const ts = line.time ? `${line.time} ` : "";
    const level = line.level ? `${line.level.toLowerCase()} ` : "";
    runtime.log(`${ts}${level}${line.message}`.trim());
  }
}
