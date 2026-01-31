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

import { sanitizeGoogleTurnOrdering } from "./bootstrap.js";

export function isGoogleModelApi(api?: string | null): boolean {
  return (
    api === "google-gemini-cli" || api === "google-generative-ai" || api === "google-antigravity"
  );
}

export function isAntigravityClaude(params: {
  api?: string | null;
  provider?: string | null;
  modelId?: string;
}): boolean {
  const provider = params.provider?.toLowerCase();
  const api = params.api?.toLowerCase();
  if (provider !== "google-antigravity" && api !== "google-antigravity") {
    return false;
  }
  return params.modelId?.toLowerCase().includes("claude") ?? false;
}

export { sanitizeGoogleTurnOrdering };
