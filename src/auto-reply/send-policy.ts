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

import { normalizeCommandBody } from "./commands-registry.js";

export type SendPolicyOverride = "allow" | "deny";

export function normalizeSendPolicyOverride(raw?: string | null): SendPolicyOverride | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  if (value === "allow" || value === "on") {
    return "allow";
  }
  if (value === "deny" || value === "off") {
    return "deny";
  }
  return undefined;
}

export function parseSendPolicyCommand(raw?: string): {
  hasCommand: boolean;
  mode?: SendPolicyOverride | "inherit";
} {
  if (!raw) {
    return { hasCommand: false };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { hasCommand: false };
  }
  const normalized = normalizeCommandBody(trimmed);
  const match = normalized.match(/^\/send(?:\s+([a-zA-Z]+))?\s*$/i);
  if (!match) {
    return { hasCommand: false };
  }
  const token = match[1]?.trim().toLowerCase();
  if (!token) {
    return { hasCommand: true };
  }
  if (token === "inherit" || token === "default" || token === "reset") {
    return { hasCommand: true, mode: "inherit" };
  }
  const mode = normalizeSendPolicyOverride(token);
  return { hasCommand: true, mode };
}
