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
import type { AgentModelListConfig } from "../config/types.js";

export const GOOGLE_GEMINI_DEFAULT_MODEL = "google/gemini-3-pro-preview";

function resolvePrimaryModel(model?: AgentModelListConfig | string): string | undefined {
  if (typeof model === "string") {
    return model;
  }
  if (model && typeof model === "object" && typeof model.primary === "string") {
    return model.primary;
  }
  return undefined;
}

export function applyGoogleGeminiModelDefault(cfg: MarketBotConfig): {
  next: MarketBotConfig;
  changed: boolean;
} {
  const current = resolvePrimaryModel(cfg.agents?.defaults?.model)?.trim();
  if (current === GOOGLE_GEMINI_DEFAULT_MODEL) {
    return { next: cfg, changed: false };
  }

  return {
    next: {
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          model:
            cfg.agents?.defaults?.model && typeof cfg.agents.defaults.model === "object"
              ? {
                  ...cfg.agents.defaults.model,
                  primary: GOOGLE_GEMINI_DEFAULT_MODEL,
                }
              : { primary: GOOGLE_GEMINI_DEFAULT_MODEL },
        },
      },
    },
    changed: true,
  };
}
