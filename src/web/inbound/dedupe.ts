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

import { createDedupeCache } from "../../infra/dedupe.js";

const RECENT_WEB_MESSAGE_TTL_MS = 20 * 60_000;
const RECENT_WEB_MESSAGE_MAX = 5000;

const recentInboundMessages = createDedupeCache({
  ttlMs: RECENT_WEB_MESSAGE_TTL_MS,
  maxSize: RECENT_WEB_MESSAGE_MAX,
});

export function resetWebInboundDedupe(): void {
  recentInboundMessages.clear();
}

export function isRecentInboundMessage(key: string): boolean {
  return recentInboundMessages.check(key);
}
