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

import type { GatewayService, GatewayServiceInstallArgs } from "./service.js";
import { resolveGatewayService } from "./service.js";
import {
  NODE_SERVICE_KIND,
  NODE_SERVICE_MARKER,
  NODE_WINDOWS_TASK_SCRIPT_NAME,
  resolveNodeLaunchAgentLabel,
  resolveNodeSystemdServiceName,
  resolveNodeWindowsTaskName,
} from "./constants.js";

function withNodeServiceEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return {
    ...env,
    MARKETBOT_LAUNCHD_LABEL: resolveNodeLaunchAgentLabel(),
    MARKETBOT_SYSTEMD_UNIT: resolveNodeSystemdServiceName(),
    MARKETBOT_WINDOWS_TASK_NAME: resolveNodeWindowsTaskName(),
    MARKETBOT_TASK_SCRIPT_NAME: NODE_WINDOWS_TASK_SCRIPT_NAME,
    MARKETBOT_LOG_PREFIX: "node",
    MARKETBOT_SERVICE_MARKER: NODE_SERVICE_MARKER,
    MARKETBOT_SERVICE_KIND: NODE_SERVICE_KIND,
  };
}

function withNodeInstallEnv(args: GatewayServiceInstallArgs): GatewayServiceInstallArgs {
  return {
    ...args,
    env: withNodeServiceEnv(args.env),
    environment: {
      ...args.environment,
      MARKETBOT_LAUNCHD_LABEL: resolveNodeLaunchAgentLabel(),
      MARKETBOT_SYSTEMD_UNIT: resolveNodeSystemdServiceName(),
      MARKETBOT_WINDOWS_TASK_NAME: resolveNodeWindowsTaskName(),
      MARKETBOT_TASK_SCRIPT_NAME: NODE_WINDOWS_TASK_SCRIPT_NAME,
      MARKETBOT_LOG_PREFIX: "node",
      MARKETBOT_SERVICE_MARKER: NODE_SERVICE_MARKER,
      MARKETBOT_SERVICE_KIND: NODE_SERVICE_KIND,
    },
  };
}

export function resolveNodeService(): GatewayService {
  const base = resolveGatewayService();
  return {
    ...base,
    install: async (args) => {
      return base.install(withNodeInstallEnv(args));
    },
    uninstall: async (args) => {
      return base.uninstall({ ...args, env: withNodeServiceEnv(args.env) });
    },
    stop: async (args) => {
      return base.stop({ ...args, env: withNodeServiceEnv(args.env ?? {}) });
    },
    restart: async (args) => {
      return base.restart({ ...args, env: withNodeServiceEnv(args.env ?? {}) });
    },
    isLoaded: async (args) => {
      return base.isLoaded({ env: withNodeServiceEnv(args.env ?? {}) });
    },
    readCommand: (env) => base.readCommand(withNodeServiceEnv(env)),
    readRuntime: (env) => base.readRuntime(withNodeServiceEnv(env)),
  };
}
