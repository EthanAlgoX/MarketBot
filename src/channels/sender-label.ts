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

export type SenderLabelParams = {
  name?: string;
  username?: string;
  tag?: string;
  e164?: string;
  id?: string;
};

function normalize(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveSenderLabel(params: SenderLabelParams): string | null {
  const name = normalize(params.name);
  const username = normalize(params.username);
  const tag = normalize(params.tag);
  const e164 = normalize(params.e164);
  const id = normalize(params.id);

  const display = name ?? username ?? tag ?? "";
  const idPart = e164 ?? id ?? "";
  if (display && idPart && display !== idPart) {
    return `${display} (${idPart})`;
  }
  return display || idPart || null;
}

export function listSenderLabelCandidates(params: SenderLabelParams): string[] {
  const candidates = new Set<string>();
  const name = normalize(params.name);
  const username = normalize(params.username);
  const tag = normalize(params.tag);
  const e164 = normalize(params.e164);
  const id = normalize(params.id);

  if (name) {
    candidates.add(name);
  }
  if (username) {
    candidates.add(username);
  }
  if (tag) {
    candidates.add(tag);
  }
  if (e164) {
    candidates.add(e164);
  }
  if (id) {
    candidates.add(id);
  }
  const resolved = resolveSenderLabel(params);
  if (resolved) {
    candidates.add(resolved);
  }
  return Array.from(candidates);
}
