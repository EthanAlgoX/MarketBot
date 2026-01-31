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

export const OPENAI_CODEX_DEFAULT_MODEL = "openai-codex/gpt-5.2";

function shouldSetOpenAICodexModel(model?: string): boolean {
  const trimmed = model?.trim();
  if (!trimmed) {
    return true;
  }
  const normalized = trimmed.toLowerCase();
  if (normalized.startsWith("openai-codex/")) {
    return false;
  }
  if (normalized.startsWith("openai/")) {
    return true;
  }
  return normalized === "gpt" || normalized === "gpt-mini";
}

function resolvePrimaryModel(model?: AgentModelListConfig | string): string | undefined {
  if (typeof model === "string") {
    return model;
  }
  if (model && typeof model === "object" && typeof model.primary === "string") {
    return model.primary;
  }
  return undefined;
}

export function applyOpenAICodexModelDefault(cfg: MarketBotConfig): {
  next: MarketBotConfig;
  changed: boolean;
} {
  const current = resolvePrimaryModel(cfg.agents?.defaults?.model);
  if (!shouldSetOpenAICodexModel(current)) {
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
                  primary: OPENAI_CODEX_DEFAULT_MODEL,
                }
              : { primary: OPENAI_CODEX_DEFAULT_MODEL },
        },
      },
    },
    changed: true,
  };
}
