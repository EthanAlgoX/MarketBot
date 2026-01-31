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

import { isTruthyEnvValue } from "../infra/env.js";

export type BrowserControlServer = {
  stop: () => Promise<void>;
};

export async function startBrowserControlServerIfEnabled(): Promise<BrowserControlServer | null> {
  if (isTruthyEnvValue(process.env.MARKETBOT_SKIP_BROWSER_CONTROL_SERVER)) {
    return null;
  }
  // Lazy import: keeps startup fast, but still bundles for the embedded
  // gateway (bun --compile) via the static specifier path.
  const override = process.env.MARKETBOT_BROWSER_CONTROL_MODULE?.trim();
  const mod = override ? await import(override) : await import("../browser/control-service.js");
  const start =
    typeof (mod as { startBrowserControlServiceFromConfig?: unknown })
      .startBrowserControlServiceFromConfig === "function"
      ? (mod as { startBrowserControlServiceFromConfig: () => Promise<unknown> })
          .startBrowserControlServiceFromConfig
      : (mod as { startBrowserControlServerFromConfig?: () => Promise<unknown> })
          .startBrowserControlServerFromConfig;
  const stop =
    typeof (mod as { stopBrowserControlService?: unknown }).stopBrowserControlService === "function"
      ? (mod as { stopBrowserControlService: () => Promise<void> }).stopBrowserControlService
      : (mod as { stopBrowserControlServer?: () => Promise<void> }).stopBrowserControlServer;
  if (!start) {
    return null;
  }
  await start();
  return { stop: stop ?? (async () => {}) };
}
