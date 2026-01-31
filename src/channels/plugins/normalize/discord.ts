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

import { parseDiscordTarget } from "../../../discord/targets.js";

export function normalizeDiscordMessagingTarget(raw: string): string | undefined {
  // Default bare IDs to channels so routing is stable across tool actions.
  const target = parseDiscordTarget(raw, { defaultKind: "channel" });
  return target?.normalized;
}

export function looksLikeDiscordTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  if (/^<@!?\d+>$/.test(trimmed)) {
    return true;
  }
  if (/^(user|channel|discord):/i.test(trimmed)) {
    return true;
  }
  if (/^\d{6,}$/.test(trimmed)) {
    return true;
  }
  return false;
}
