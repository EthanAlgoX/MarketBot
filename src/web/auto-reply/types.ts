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

import type { monitorWebInbox } from "../inbound.js";
import type { ReconnectPolicy } from "../reconnect.js";

export type WebInboundMsg = Parameters<typeof monitorWebInbox>[0]["onMessage"] extends (
  msg: infer M,
) => unknown
  ? M
  : never;

export type WebChannelStatus = {
  running: boolean;
  connected: boolean;
  reconnectAttempts: number;
  lastConnectedAt?: number | null;
  lastDisconnect?: {
    at: number;
    status?: number;
    error?: string;
    loggedOut?: boolean;
  } | null;
  lastMessageAt?: number | null;
  lastEventAt?: number | null;
  lastError?: string | null;
};

export type WebMonitorTuning = {
  reconnect?: Partial<ReconnectPolicy>;
  heartbeatSeconds?: number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  statusSink?: (status: WebChannelStatus) => void;
  /** WhatsApp account id. Default: "default". */
  accountId?: string;
  /** Debounce window (ms) for batching rapid consecutive messages from the same sender. */
  debounceMs?: number;
};
