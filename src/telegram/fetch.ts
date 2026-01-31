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

import * as net from "node:net";
import { resolveFetch } from "../infra/fetch.js";
import type { TelegramNetworkConfig } from "../config/types.telegram.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveTelegramAutoSelectFamilyDecision } from "./network-config.js";

let appliedAutoSelectFamily: boolean | null = null;
const log = createSubsystemLogger("telegram/network");

// Node 22 workaround: disable autoSelectFamily to avoid Happy Eyeballs timeouts.
// See: https://github.com/nodejs/node/issues/54359
function applyTelegramNetworkWorkarounds(network?: TelegramNetworkConfig): void {
  const decision = resolveTelegramAutoSelectFamilyDecision({ network });
  if (decision.value === null || decision.value === appliedAutoSelectFamily) {
    return;
  }
  appliedAutoSelectFamily = decision.value;

  if (typeof net.setDefaultAutoSelectFamily === "function") {
    try {
      net.setDefaultAutoSelectFamily(decision.value);
      const label = decision.source ? ` (${decision.source})` : "";
      log.info(`telegram: autoSelectFamily=${decision.value}${label}`);
    } catch {
      // ignore if unsupported by the runtime
    }
  }
}

// Prefer wrapped fetch when available to normalize AbortSignal across runtimes.
export function resolveTelegramFetch(
  proxyFetch?: typeof fetch,
  options?: { network?: TelegramNetworkConfig },
): typeof fetch | undefined {
  applyTelegramNetworkWorkarounds(options?.network);
  if (proxyFetch) {
    return resolveFetch(proxyFetch);
  }
  const fetchImpl = resolveFetch();
  if (!fetchImpl) {
    throw new Error("fetch is not available; set channels.telegram.proxy in config");
  }
  return fetchImpl;
}
