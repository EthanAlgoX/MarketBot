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

import type { Server } from "node:http";
import express from "express";

import { loadConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveBrowserConfig } from "./config.js";
import { registerBrowserRoutes } from "./routes/index.js";
import type { BrowserRouteRegistrar } from "./routes/types.js";
import { type BrowserServerState, createBrowserRouteContext } from "./server-context.js";

let state: BrowserServerState | null = null;
const log = createSubsystemLogger("browser");
const logServer = log.child("server");

export async function startBrowserControlServerFromConfig(): Promise<BrowserServerState | null> {
  if (state) {
    return state;
  }

  const cfg = loadConfig();
  const resolved = resolveBrowserConfig(cfg.browser, cfg);
  if (!resolved.enabled) {
    return null;
  }

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const ctx = createBrowserRouteContext({
    getState: () => state,
  });
  registerBrowserRoutes(app as unknown as BrowserRouteRegistrar, ctx);

  const port = resolved.controlPort;
  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(port, "127.0.0.1", () => resolve(s));
    s.once("error", reject);
  }).catch((err) => {
    logServer.error(`marketbot browser server failed to bind 127.0.0.1:${port}: ${String(err)}`);
    return null;
  });

  if (!server) {
    return null;
  }

  state = {
    server,
    port,
    resolved,
    profiles: new Map(),
  };

  logServer.info(`Browser control listening on http://127.0.0.1:${port}/`);
  return state;
}

export async function stopBrowserControlServer(): Promise<void> {
  const current = state;
  if (!current) {
    return;
  }

  const ctx = createBrowserRouteContext({
    getState: () => state,
  });

  try {
    const current = state;
    if (current) {
      for (const name of Object.keys(current.resolved.profiles)) {
        try {
          await ctx.forProfile(name).stopRunningBrowser();
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    logServer.warn(`marketbot browser stop failed: ${String(err)}`);
  }

  if (current.server) {
    await new Promise<void>((resolve) => {
      current.server?.close(() => resolve());
    });
  }
  state = null;

  // Optional: Playwright is not always available (e.g. embedded gateway builds).
  try {
    const mod = await import("./pw-ai.js");
    await mod.closePlaywrightBrowserConnection();
  } catch {
    // ignore
  }
}
