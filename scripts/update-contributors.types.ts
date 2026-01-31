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

export type MapConfig = {
  ensureLogins?: string[];
  displayName?: Record<string, string>;
  nameToLogin?: Record<string, string>;
  emailToLogin?: Record<string, string>;
  placeholderAvatar?: string;
  seedCommit?: string;
};

export type ApiContributor = {
  login?: string;
  html_url?: string;
  avatar_url?: string;
  name?: string;
  email?: string;
  contributions?: number;
};

export type User = {
  login: string;
  html_url: string;
  avatar_url: string;
};

export type Entry = {
  key: string;
  login?: string;
  display: string;
  html_url: string;
  avatar_url: string;
  lines: number;
};
