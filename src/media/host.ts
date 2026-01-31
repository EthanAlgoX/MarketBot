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
import { ensurePortAvailable, PortInUseError } from "../infra/ports.js";
import { getTailnetHostname } from "../infra/tailscale.js";
import { logInfo } from "../logger.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { formatCliCommand } from "../cli/command-format.js";
import { startMediaServer } from "./server.js";
import { saveMediaSource } from "./store.js";

const DEFAULT_PORT = 42873;
const TTL_MS = 2 * 60 * 1000;

let mediaServer: import("http").Server | null = null;

export type HostedMedia = {
  url: string;
  id: string;
  size: number;
};

export async function ensureMediaHosted(
  source: string,
  opts: {
    port?: number;
    startServer?: boolean;
    runtime?: RuntimeEnv;
  } = {},
): Promise<HostedMedia> {
  const port = opts.port ?? DEFAULT_PORT;
  const runtime = opts.runtime ?? defaultRuntime;

  const saved = await saveMediaSource(source);
  const hostname = await getTailnetHostname();

  // Decide whether we must start a media server.
  const needsServerStart = await isPortFree(port);
  if (needsServerStart && !opts.startServer) {
    await fs.rm(saved.path).catch(() => {});
    throw new Error(
      `Media hosting requires the webhook/Funnel server. Start \`${formatCliCommand("marketbot webhook")}\`/\`${formatCliCommand("marketbot up")}\` or re-run with --serve-media.`,
    );
  }
  if (needsServerStart && opts.startServer) {
    if (!mediaServer) {
      mediaServer = await startMediaServer(port, TTL_MS, runtime);
      logInfo(
        `📈 Started temporary media host on http://localhost:${port}/media/:id (TTL ${TTL_MS / 1000}s)`,
        runtime,
      );
      mediaServer.unref?.();
    }
  }

  const url = `https://${hostname}/media/${saved.id}`;
  return { url, id: saved.id, size: saved.size };
}

async function isPortFree(port: number) {
  try {
    await ensurePortAvailable(port);
    return true;
  } catch (err) {
    if (err instanceof PortInUseError) {
      return false;
    }
    throw err;
  }
}
