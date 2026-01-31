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

import { listChannelPluginCatalogEntries } from "../channels/plugins/catalog.js";
import { CHAT_CHANNEL_ORDER } from "../channels/registry.js";
import { listChannelPlugins } from "../channels/plugins/index.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { ensurePluginRegistryLoaded } from "./plugin-registry.js";

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    resolved.push(value);
  }
  return resolved;
}

export function resolveCliChannelOptions(): string[] {
  const catalog = listChannelPluginCatalogEntries().map((entry) => entry.id);
  const base = dedupe([...CHAT_CHANNEL_ORDER, ...catalog]);
  if (isTruthyEnvValue(process.env.MARKETBOT_EAGER_CHANNEL_OPTIONS)) {
    ensurePluginRegistryLoaded();
    const pluginIds = listChannelPlugins().map((plugin) => plugin.id);
    return dedupe([...base, ...pluginIds]);
  }
  return base;
}

export function formatCliChannelOptions(extra: string[] = []): string {
  return [...extra, ...resolveCliChannelOptions()].join("|");
}
