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

export type EchoTracker = {
  rememberText: (
    text: string | undefined,
    opts: {
      combinedBody?: string;
      combinedBodySessionKey?: string;
      logVerboseMessage?: boolean;
    },
  ) => void;
  has: (key: string) => boolean;
  forget: (key: string) => void;
  buildCombinedKey: (params: { sessionKey: string; combinedBody: string }) => string;
};

export function createEchoTracker(params: {
  maxItems?: number;
  logVerbose?: (msg: string) => void;
}): EchoTracker {
  const recentlySent = new Set<string>();
  const maxItems = Math.max(1, params.maxItems ?? 100);

  const buildCombinedKey = (p: { sessionKey: string; combinedBody: string }) =>
    `combined:${p.sessionKey}:${p.combinedBody}`;

  const trim = () => {
    while (recentlySent.size > maxItems) {
      const firstKey = recentlySent.values().next().value;
      if (!firstKey) {
        break;
      }
      recentlySent.delete(firstKey);
    }
  };

  const rememberText: EchoTracker["rememberText"] = (text, opts) => {
    if (!text) {
      return;
    }
    recentlySent.add(text);
    if (opts.combinedBody && opts.combinedBodySessionKey) {
      recentlySent.add(
        buildCombinedKey({
          sessionKey: opts.combinedBodySessionKey,
          combinedBody: opts.combinedBody,
        }),
      );
    }
    if (opts.logVerboseMessage) {
      params.logVerbose?.(
        `Added to echo detection set (size now: ${recentlySent.size}): ${text.substring(0, 50)}...`,
      );
    }
    trim();
  };

  return {
    rememberText,
    has: (key) => recentlySent.has(key),
    forget: (key) => {
      recentlySent.delete(key);
    },
    buildCombinedKey,
  };
}
