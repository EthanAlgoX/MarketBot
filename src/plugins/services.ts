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

import type { MarketBotConfig } from "../config/config.js";
import { STATE_DIR } from "../config/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { PluginRegistry } from "./registry.js";

const log = createSubsystemLogger("plugins");

export type PluginServicesHandle = {
  stop: () => Promise<void>;
};

export async function startPluginServices(params: {
  registry: PluginRegistry;
  config: MarketBotConfig;
  workspaceDir?: string;
}): Promise<PluginServicesHandle> {
  const running: Array<{
    id: string;
    stop?: () => void | Promise<void>;
  }> = [];

  for (const entry of params.registry.services) {
    const service = entry.service;
    try {
      await service.start({
        config: params.config,
        workspaceDir: params.workspaceDir,
        stateDir: STATE_DIR,
        logger: {
          info: (msg) => log.info(msg),
          warn: (msg) => log.warn(msg),
          error: (msg) => log.error(msg),
          debug: (msg) => log.debug(msg),
        },
      });
      running.push({
        id: service.id,
        stop: service.stop
          ? () =>
              service.stop?.({
                config: params.config,
                workspaceDir: params.workspaceDir,
                stateDir: STATE_DIR,
                logger: {
                  info: (msg) => log.info(msg),
                  warn: (msg) => log.warn(msg),
                  error: (msg) => log.error(msg),
                  debug: (msg) => log.debug(msg),
                },
              })
          : undefined,
      });
    } catch (err) {
      log.error(`plugin service failed (${service.id}): ${String(err)}`);
    }
  }

  return {
    stop: async () => {
      for (const entry of running.toReversed()) {
        if (!entry.stop) {
          continue;
        }
        try {
          await entry.stop();
        } catch (err) {
          log.warn(`plugin service stop failed (${entry.id}): ${String(err)}`);
        }
      }
    },
  };
}
