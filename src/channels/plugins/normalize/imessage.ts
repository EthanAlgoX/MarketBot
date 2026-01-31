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

import { normalizeIMessageHandle } from "../../../imessage/targets.js";

// Service prefixes that indicate explicit delivery method; must be preserved during normalization
const SERVICE_PREFIXES = ["imessage:", "sms:", "auto:"] as const;
const CHAT_TARGET_PREFIX_RE =
  /^(chat_id:|chatid:|chat:|chat_guid:|chatguid:|guid:|chat_identifier:|chatidentifier:|chatident:)/i;

export function normalizeIMessageMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  // Preserve service prefix if present (e.g., "sms:+1555" → "sms:+15551234567")
  const lower = trimmed.toLowerCase();
  for (const prefix of SERVICE_PREFIXES) {
    if (lower.startsWith(prefix)) {
      const remainder = trimmed.slice(prefix.length).trim();
      const normalizedHandle = normalizeIMessageHandle(remainder);
      if (!normalizedHandle) {
        return undefined;
      }
      if (CHAT_TARGET_PREFIX_RE.test(normalizedHandle)) {
        return normalizedHandle;
      }
      return `${prefix}${normalizedHandle}`;
    }
  }

  const normalized = normalizeIMessageHandle(trimmed);
  return normalized || undefined;
}

export function looksLikeIMessageTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  if (/^(imessage:|sms:|auto:)/i.test(trimmed)) {
    return true;
  }
  if (CHAT_TARGET_PREFIX_RE.test(trimmed)) {
    return true;
  }
  if (trimmed.includes("@")) {
    return true;
  }
  return /^\+?\d{3,}$/.test(trimmed);
}
