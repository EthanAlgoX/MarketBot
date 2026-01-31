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

export function isStatusCommand(body: string) {
  const trimmed = body.trim().toLowerCase();
  if (!trimmed) {
    return false;
  }
  return trimmed === "/status" || trimmed === "status" || trimmed.startsWith("/status ");
}

export function stripMentionsForCommand(
  text: string,
  mentionRegexes: RegExp[],
  selfE164?: string | null,
) {
  let result = text;
  for (const re of mentionRegexes) {
    result = result.replace(re, " ");
  }
  if (selfE164) {
    // `selfE164` is usually like "+1234"; strip down to digits so we can match "+?1234" safely.
    const digits = selfE164.replace(/\D/g, "");
    if (digits) {
      const pattern = new RegExp(`\\+?${digits}`, "g");
      result = result.replace(pattern, " ");
    }
  }
  return result.replace(/\s+/g, " ").trim();
}
