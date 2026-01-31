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

const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function isValidProfileName(value: string): boolean {
  if (!value) {
    return false;
  }
  // Keep it path-safe + shell-friendly.
  return PROFILE_NAME_RE.test(value);
}

export function normalizeProfileName(raw?: string | null): string | null {
  const profile = raw?.trim();
  if (!profile) {
    return null;
  }
  if (profile.toLowerCase() === "default") {
    return null;
  }
  if (!isValidProfileName(profile)) {
    return null;
  }
  return profile;
}
