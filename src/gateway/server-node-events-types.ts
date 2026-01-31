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

import type { ModelCatalogEntry } from "../agents/model-catalog.js";
import type { CliDeps } from "../cli/deps.js";
import type { HealthSummary } from "../commands/health.js";
import type { ChatAbortControllerEntry } from "./chat-abort.js";
import type { ChatRunEntry } from "./server-chat.js";
import type { DedupeEntry } from "./server-shared.js";

export type NodeEventContext = {
  deps: CliDeps;
  broadcast: (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => void;
  nodeSendToSession: (sessionKey: string, event: string, payload: unknown) => void;
  nodeSubscribe: (nodeId: string, sessionKey: string) => void;
  nodeUnsubscribe: (nodeId: string, sessionKey: string) => void;
  broadcastVoiceWakeChanged: (triggers: string[]) => void;
  addChatRun: (sessionId: string, entry: ChatRunEntry) => void;
  removeChatRun: (
    sessionId: string,
    clientRunId: string,
    sessionKey?: string,
  ) => ChatRunEntry | undefined;
  chatAbortControllers: Map<string, ChatAbortControllerEntry>;
  chatAbortedRuns: Map<string, number>;
  chatRunBuffers: Map<string, string>;
  chatDeltaSentAt: Map<string, number>;
  dedupe: Map<string, DedupeEntry>;
  agentRunSeq: Map<string, number>;
  getHealthCache: () => HealthSummary | null;
  refreshHealthSnapshot: (opts?: { probe?: boolean }) => Promise<HealthSummary>;
  loadGatewayModelCatalog: () => Promise<ModelCatalogEntry[]>;
  logGateway: { warn: (msg: string) => void };
};

export type NodeEvent = {
  event: string;
  payloadJSON?: string | null;
};
