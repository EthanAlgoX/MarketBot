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

import type { MarketBotConfig } from "./config.js";
import type { WhatsAppConfig } from "./types.js";

export type MergeSectionOptions<T> = {
  unsetOnUndefined?: Array<keyof T>;
};

export function mergeConfigSection<T extends Record<string, unknown>>(
  base: T | undefined,
  patch: Partial<T>,
  options: MergeSectionOptions<T> = {},
): T {
  const next: Record<string, unknown> = { ...(base ?? undefined) };
  for (const [key, value] of Object.entries(patch) as [keyof T, T[keyof T]][]) {
    if (value === undefined) {
      if (options.unsetOnUndefined?.includes(key)) {
        delete next[key as string];
      }
      continue;
    }
    next[key as string] = value as unknown;
  }
  return next as T;
}

export function mergeWhatsAppConfig(
  cfg: MarketBotConfig,
  patch: Partial<WhatsAppConfig>,
  options?: MergeSectionOptions<WhatsAppConfig>,
): MarketBotConfig {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      whatsapp: mergeConfigSection(cfg.channels?.whatsapp, patch, options),
    },
  };
}
