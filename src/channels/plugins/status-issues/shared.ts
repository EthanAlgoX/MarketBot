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

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function formatMatchMetadata(params: {
  matchKey?: unknown;
  matchSource?: unknown;
}): string | undefined {
  const matchKey =
    typeof params.matchKey === "string"
      ? params.matchKey
      : typeof params.matchKey === "number"
        ? String(params.matchKey)
        : undefined;
  const matchSource = asString(params.matchSource);
  const parts = [
    matchKey ? `matchKey=${matchKey}` : null,
    matchSource ? `matchSource=${matchSource}` : null,
  ].filter((entry): entry is string => Boolean(entry));
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function appendMatchMetadata(
  message: string,
  params: { matchKey?: unknown; matchSource?: unknown },
): string {
  const meta = formatMatchMetadata(params);
  return meta ? `${message} (${meta})` : message;
}
