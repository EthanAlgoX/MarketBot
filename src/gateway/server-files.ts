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

import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import type { MarketBotConfig } from "../config/types.js";
import { openFileWithinRoot, SafeOpenError } from "../infra/fs-safe.js";
import { detectMime } from "../media/mime.js";

const FILES_PATH_PREFIX = "/api/files/";

/**
 * Serves files from the agent workspace directory.
 *
 * Route: GET /api/files/<relative-path>
 *
 * Only serves files that live under the resolved workspace root (path-traversal safe).
 * Intended for rendering agent-generated images (charts, screenshots, etc.) inline
 * in the Control UI chat.
 */
export async function handleFilesHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { config: MarketBotConfig },
): Promise<boolean> {
  const urlRaw = req.url;
  if (!urlRaw) {
    return false;
  }

  const url = new URL(urlRaw, "http://localhost");
  if (!url.pathname.startsWith(FILES_PATH_PREFIX)) {
    return false;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return true;
  }

  const rawPath = decodeURIComponent(url.pathname.slice(FILES_PATH_PREFIX.length));
  if (!rawPath) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Missing file path");
    return true;
  }

  // Resolve workspace root for the default agent.
  const agentId = resolveDefaultAgentId(opts.config);
  const workspaceDir = resolveAgentWorkspaceDir(opts.config, agentId);

  // If the path is absolute, strip the workspace root prefix to get a relative path.
  // This handles agent output like `![chart](/Users/user/.marketbot/workspace/chart.png)`.
  const workspaceDirWithSep = workspaceDir.endsWith(path.sep)
    ? workspaceDir
    : workspaceDir + path.sep;
  const relativePath = rawPath.startsWith(workspaceDirWithSep)
    ? rawPath.slice(workspaceDirWithSep.length)
    : rawPath.startsWith(workspaceDir + "/")
      ? rawPath.slice(workspaceDir.length + 1)
      : rawPath;

  try {
    const { handle, realPath } = await openFileWithinRoot({
      rootDir: workspaceDir,
      relativePath,
    });

    let data: Buffer;
    try {
      data = await handle.readFile();
    } finally {
      await handle.close().catch(() => {});
    }

    const mime =
      (await detectMime({ filePath: realPath, buffer: data })) ?? "application/octet-stream";

    res.statusCode = 200;
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "no-store");
    // Allow the Control UI (served from same origin) to load this resource.
    res.setHeader("X-Content-Type-Options", "nosniff");

    const filename = path.basename(realPath);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.end(data);
    return true;
  } catch (err) {
    if (err instanceof SafeOpenError) {
      res.statusCode = err.code === "not-found" ? 404 : 403;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(err.code === "not-found" ? "Not Found" : "Forbidden");
      return true;
    }
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
    return true;
  }
}
