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

export type TargetIdResolution =
  | { ok: true; targetId: string }
  | { ok: false; reason: "not_found" | "ambiguous"; matches?: string[] };

export function resolveTargetIdFromTabs(
  input: string,
  tabs: Array<{ targetId: string }>,
): TargetIdResolution {
  const needle = input.trim();
  if (!needle) {
    return { ok: false, reason: "not_found" };
  }

  const exact = tabs.find((t) => t.targetId === needle);
  if (exact) {
    return { ok: true, targetId: exact.targetId };
  }

  const lower = needle.toLowerCase();
  const matches = tabs.map((t) => t.targetId).filter((id) => id.toLowerCase().startsWith(lower));

  const only = matches.length === 1 ? matches[0] : undefined;
  if (only) {
    return { ok: true, targetId: only };
  }
  if (matches.length === 0) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: false, reason: "ambiguous", matches };
}
