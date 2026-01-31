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

import type { MarketBotConfig } from "../config/config.js";
import type { PluginSlotsConfig } from "../config/types.plugins.js";
import type { PluginKind } from "./types.js";

export type PluginSlotKey = keyof PluginSlotsConfig;

type SlotPluginRecord = {
  id: string;
  kind?: PluginKind;
};

const SLOT_BY_KIND: Record<PluginKind, PluginSlotKey> = {
  memory: "memory",
};

const DEFAULT_SLOT_BY_KEY: Record<PluginSlotKey, string> = {
  memory: "memory-core",
};

export function slotKeyForPluginKind(kind?: PluginKind): PluginSlotKey | null {
  if (!kind) {
    return null;
  }
  return SLOT_BY_KIND[kind] ?? null;
}

export function defaultSlotIdForKey(slotKey: PluginSlotKey): string {
  return DEFAULT_SLOT_BY_KEY[slotKey];
}

export type SlotSelectionResult = {
  config: MarketBotConfig;
  warnings: string[];
  changed: boolean;
};

export function applyExclusiveSlotSelection(params: {
  config: MarketBotConfig;
  selectedId: string;
  selectedKind?: PluginKind;
  registry?: { plugins: SlotPluginRecord[] };
}): SlotSelectionResult {
  const slotKey = slotKeyForPluginKind(params.selectedKind);
  if (!slotKey) {
    return { config: params.config, warnings: [], changed: false };
  }

  const warnings: string[] = [];
  const pluginsConfig = params.config.plugins ?? {};
  const prevSlot = pluginsConfig.slots?.[slotKey];
  const slots = {
    ...pluginsConfig.slots,
    [slotKey]: params.selectedId,
  };

  const inferredPrevSlot = prevSlot ?? defaultSlotIdForKey(slotKey);
  if (inferredPrevSlot && inferredPrevSlot !== params.selectedId) {
    warnings.push(
      `Exclusive slot "${slotKey}" switched from "${inferredPrevSlot}" to "${params.selectedId}".`,
    );
  }

  const entries = { ...pluginsConfig.entries };
  const disabledIds: string[] = [];
  if (params.registry) {
    for (const plugin of params.registry.plugins) {
      if (plugin.id === params.selectedId) {
        continue;
      }
      if (plugin.kind !== params.selectedKind) {
        continue;
      }
      const entry = entries[plugin.id];
      if (!entry || entry.enabled !== false) {
        entries[plugin.id] = {
          ...entry,
          enabled: false,
        };
        disabledIds.push(plugin.id);
      }
    }
  }

  if (disabledIds.length > 0) {
    warnings.push(
      `Disabled other "${slotKey}" slot plugins: ${disabledIds.toSorted().join(", ")}.`,
    );
  }

  const changed = prevSlot !== params.selectedId || disabledIds.length > 0;

  if (!changed) {
    return { config: params.config, warnings: [], changed: false };
  }

  return {
    config: {
      ...params.config,
      plugins: {
        ...pluginsConfig,
        slots,
        entries,
      },
    },
    warnings,
    changed: true,
  };
}
