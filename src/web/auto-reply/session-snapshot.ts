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

import type { loadConfig } from "../../config/config.js";
import {
  evaluateSessionFreshness,
  loadSessionStore,
  resolveChannelResetConfig,
  resolveThreadFlag,
  resolveSessionResetPolicy,
  resolveSessionResetType,
  resolveSessionKey,
  resolveStorePath,
} from "../../config/sessions.js";
import { normalizeMainKey } from "../../routing/session-key.js";

export function getSessionSnapshot(
  cfg: ReturnType<typeof loadConfig>,
  from: string,
  _isHeartbeat = false,
  ctx?: {
    sessionKey?: string | null;
    isGroup?: boolean;
    messageThreadId?: string | number | null;
    threadLabel?: string | null;
    threadStarterBody?: string | null;
    parentSessionKey?: string | null;
  },
) {
  const sessionCfg = cfg.session;
  const scope = sessionCfg?.scope ?? "per-sender";
  const key =
    ctx?.sessionKey?.trim() ??
    resolveSessionKey(
      scope,
      { From: from, To: "", Body: "" },
      normalizeMainKey(sessionCfg?.mainKey),
    );
  const store = loadSessionStore(resolveStorePath(sessionCfg?.store));
  const entry = store[key];

  const isThread = resolveThreadFlag({
    sessionKey: key,
    messageThreadId: ctx?.messageThreadId ?? null,
    threadLabel: ctx?.threadLabel ?? null,
    threadStarterBody: ctx?.threadStarterBody ?? null,
    parentSessionKey: ctx?.parentSessionKey ?? null,
  });
  const resetType = resolveSessionResetType({ sessionKey: key, isGroup: ctx?.isGroup, isThread });
  const channelReset = resolveChannelResetConfig({
    sessionCfg,
    channel: entry?.lastChannel ?? entry?.channel,
  });
  const resetPolicy = resolveSessionResetPolicy({
    sessionCfg,
    resetType,
    resetOverride: channelReset,
  });
  const now = Date.now();
  const freshness = entry
    ? evaluateSessionFreshness({ updatedAt: entry.updatedAt, now, policy: resetPolicy })
    : { fresh: false };
  return {
    key,
    entry,
    fresh: freshness.fresh,
    resetPolicy,
    resetType,
    dailyResetAt: freshness.dailyResetAt,
    idleExpiresAt: freshness.idleExpiresAt,
  };
}
