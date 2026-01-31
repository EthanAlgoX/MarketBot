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

import type { SessionEntry } from "../../config/sessions.js";
import { updateSessionStore } from "../../config/sessions.js";
import { setAbortMemory } from "./abort.js";

export async function applySessionHints(params: {
  baseBody: string;
  abortedLastRun: boolean;
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey?: string;
  storePath?: string;
  abortKey?: string;
  messageId?: string;
}): Promise<string> {
  let prefixedBodyBase = params.baseBody;
  const abortedHint = params.abortedLastRun
    ? "Note: The previous agent run was aborted by the user. Resume carefully or ask for clarification."
    : "";
  if (abortedHint) {
    prefixedBodyBase = `${abortedHint}\n\n${prefixedBodyBase}`;
    if (params.sessionEntry && params.sessionStore && params.sessionKey) {
      params.sessionEntry.abortedLastRun = false;
      params.sessionEntry.updatedAt = Date.now();
      params.sessionStore[params.sessionKey] = params.sessionEntry;
      if (params.storePath) {
        const sessionKey = params.sessionKey;
        await updateSessionStore(params.storePath, (store) => {
          const entry = store[sessionKey] ?? params.sessionEntry;
          if (!entry) {
            return;
          }
          store[sessionKey] = {
            ...entry,
            abortedLastRun: false,
            updatedAt: Date.now(),
          };
        });
      }
    } else if (params.abortKey) {
      setAbortMemory(params.abortKey, false);
    }
  }

  const messageIdHint = params.messageId?.trim() ? `[message_id: ${params.messageId.trim()}]` : "";
  if (messageIdHint) {
    prefixedBodyBase = `${prefixedBodyBase}\n${messageIdHint}`;
  }

  return prefixedBodyBase;
}
