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

export function parseConfigValue(raw: string): {
  value?: unknown;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Missing value." };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return { value: JSON.parse(trimmed) };
    } catch (err) {
      return { error: `Invalid JSON: ${String(err)}` };
    }
  }

  if (trimmed === "true") {
    return { value: true };
  }
  if (trimmed === "false") {
    return { value: false };
  }
  if (trimmed === "null") {
    return { value: null };
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (Number.isFinite(num)) {
      return { value: num };
    }
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      return { value: JSON.parse(trimmed) };
    } catch {
      const unquoted = trimmed.slice(1, -1);
      return { value: unquoted };
    }
  }

  return { value: trimmed };
}
