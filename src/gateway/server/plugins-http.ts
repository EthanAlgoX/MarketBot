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

import type { createSubsystemLogger } from "../../logging/subsystem.js";
import type { PluginRegistry } from "../../plugins/registry.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

export type PluginHttpRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<boolean>;

export function createGatewayPluginRequestHandler(params: {
  registry: PluginRegistry;
  log: SubsystemLogger;
}): PluginHttpRequestHandler {
  const { registry, log } = params;
  return async (req, res) => {
    const routes = registry.httpRoutes ?? [];
    const handlers = registry.httpHandlers ?? [];
    if (routes.length === 0 && handlers.length === 0) {
      return false;
    }

    if (routes.length > 0) {
      const url = new URL(req.url ?? "/", "http://localhost");
      const route = routes.find((entry) => entry.path === url.pathname);
      if (route) {
        try {
          await route.handler(req, res);
          return true;
        } catch (err) {
          log.warn(`plugin http route failed (${route.pluginId ?? "unknown"}): ${String(err)}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end("Internal Server Error");
          }
          return true;
        }
      }
    }

    for (const entry of handlers) {
      try {
        const handled = await entry.handler(req, res);
        if (handled) {
          return true;
        }
      } catch (err) {
        log.warn(`plugin http handler failed (${entry.pluginId}): ${String(err)}`);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Internal Server Error");
        }
        return true;
      }
    }
    return false;
  };
}
