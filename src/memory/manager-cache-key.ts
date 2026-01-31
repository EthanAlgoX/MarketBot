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

import type { ResolvedMemorySearchConfig } from "../agents/memory-search.js";

import { hashText } from "./internal.js";
import { fingerprintHeaderNames } from "./headers-fingerprint.js";

export function computeMemoryManagerCacheKey(params: {
  agentId: string;
  workspaceDir: string;
  settings: ResolvedMemorySearchConfig;
}): string {
  const settings = params.settings;
  const fingerprint = hashText(
    JSON.stringify({
      enabled: settings.enabled,
      sources: [...settings.sources].toSorted((a, b) => a.localeCompare(b)),
      extraPaths: [...settings.extraPaths].toSorted((a, b) => a.localeCompare(b)),
      provider: settings.provider,
      model: settings.model,
      fallback: settings.fallback,
      local: {
        modelPath: settings.local.modelPath,
        modelCacheDir: settings.local.modelCacheDir,
      },
      remote: settings.remote
        ? {
            baseUrl: settings.remote.baseUrl,
            headerNames: fingerprintHeaderNames(settings.remote.headers),
            batch: settings.remote.batch
              ? {
                  enabled: settings.remote.batch.enabled,
                  wait: settings.remote.batch.wait,
                  concurrency: settings.remote.batch.concurrency,
                  pollIntervalMs: settings.remote.batch.pollIntervalMs,
                  timeoutMinutes: settings.remote.batch.timeoutMinutes,
                }
              : undefined,
          }
        : undefined,
      experimental: settings.experimental,
      store: {
        driver: settings.store.driver,
        path: settings.store.path,
        vector: {
          enabled: settings.store.vector.enabled,
          extensionPath: settings.store.vector.extensionPath,
        },
      },
      chunking: settings.chunking,
      sync: settings.sync,
      query: settings.query,
      cache: settings.cache,
    }),
  );
  return `${params.agentId}:${params.workspaceDir}:${fingerprint}`;
}
