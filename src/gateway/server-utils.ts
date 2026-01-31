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

import { defaultVoiceWakeTriggers } from "../infra/voicewake.js";

export function normalizeVoiceWakeTriggers(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : [];
  const cleaned = raw
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0)
    .slice(0, 32)
    .map((v) => v.slice(0, 64));
  return cleaned.length > 0 ? cleaned : defaultVoiceWakeTriggers();
}

export function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  const statusValue = (err as { status?: unknown })?.status;
  const codeValue = (err as { code?: unknown })?.code;
  const hasStatus = statusValue !== undefined;
  const hasCode = codeValue !== undefined;
  if (hasStatus || hasCode) {
    const statusText =
      typeof statusValue === "string" || typeof statusValue === "number"
        ? String(statusValue)
        : "unknown";
    const codeText =
      typeof codeValue === "string" || typeof codeValue === "number"
        ? String(codeValue)
        : "unknown";
    return `status=${statusText} code=${codeText}`;
  }
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}
