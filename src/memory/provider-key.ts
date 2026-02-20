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

import { hashText } from "./internal.js";
import { fingerprintHeaderNames } from "./headers-fingerprint.js";

export function computeEmbeddingProviderKey(params: {
  providerId: string;
  providerModel: string;
  openAi?: { baseUrl: string; model: string; headers: Record<string, string> };
  gemini?: { baseUrl: string; model: string; headers: Record<string, string> };
}): string {
  if (params.openAi) {
    const headerNames = fingerprintHeaderNames(params.openAi.headers);
    return hashText(
      JSON.stringify({
        provider: "openai",
        baseUrl: params.openAi.baseUrl,
        model: params.openAi.model,
        headerNames,
      }),
    );
  }
  if (params.gemini) {
    const headerNames = fingerprintHeaderNames(params.gemini.headers);
    return hashText(
      JSON.stringify({
        provider: "gemini",
        baseUrl: params.gemini.baseUrl,
        model: params.gemini.model,
        headerNames,
      }),
    );
  }
  return hashText(JSON.stringify({ provider: params.providerId, model: params.providerModel }));
}
