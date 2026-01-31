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

const KEY_SPLIT_RE = /[\s,;]+/g;

function parseKeyList(raw?: string | null): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(KEY_SPLIT_RE)
    .map((value) => value.trim())
    .filter(Boolean);
}

function collectEnvPrefixedKeys(prefix: string): string[] {
  const keys: string[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith(prefix)) {
      continue;
    }
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }
    keys.push(trimmed);
  }
  return keys;
}

export function collectAnthropicApiKeys(): string[] {
  const forcedSingle = process.env.MARKETBOT_LIVE_ANTHROPIC_KEY?.trim();
  if (forcedSingle) {
    return [forcedSingle];
  }

  const fromList = parseKeyList(process.env.MARKETBOT_LIVE_ANTHROPIC_KEYS);
  const fromEnv = collectEnvPrefixedKeys("ANTHROPIC_API_KEY");
  const primary = process.env.ANTHROPIC_API_KEY?.trim();

  const seen = new Set<string>();
  const add = (value?: string) => {
    if (!value) {
      return;
    }
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
  };

  for (const value of fromList) {
    add(value);
  }
  if (primary) {
    add(primary);
  }
  for (const value of fromEnv) {
    add(value);
  }

  return Array.from(seen);
}

export function isAnthropicRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("rate_limit")) {
    return true;
  }
  if (lower.includes("rate limit")) {
    return true;
  }
  if (lower.includes("429")) {
    return true;
  }
  return false;
}

export function isAnthropicBillingError(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("credit balance")) {
    return true;
  }
  if (lower.includes("insufficient credit")) {
    return true;
  }
  if (lower.includes("insufficient credits")) {
    return true;
  }
  if (lower.includes("payment required")) {
    return true;
  }
  if (lower.includes("billing") && lower.includes("disabled")) {
    return true;
  }
  if (lower.includes("402")) {
    return true;
  }
  return false;
}
