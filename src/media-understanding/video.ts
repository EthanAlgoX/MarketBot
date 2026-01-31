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

import { DEFAULT_VIDEO_MAX_BASE64_BYTES } from "./defaults.js";

export function estimateBase64Size(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

export function resolveVideoMaxBase64Bytes(maxBytes: number): number {
  const expanded = Math.floor(maxBytes * (4 / 3));
  return Math.min(expanded, DEFAULT_VIDEO_MAX_BASE64_BYTES);
}
