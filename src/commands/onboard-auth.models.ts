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

import type { ModelDefinitionConfig } from "../config/types.js";

export const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/v1";
export const MINIMAX_API_BASE_URL = "https://api.minimax.io/anthropic";
export const MINIMAX_HOSTED_MODEL_ID = "MiniMax-M2.1";
export const MINIMAX_HOSTED_MODEL_REF = `minimax/${MINIMAX_HOSTED_MODEL_ID}`;
export const DEFAULT_MINIMAX_CONTEXT_WINDOW = 200000;
export const DEFAULT_MINIMAX_MAX_TOKENS = 8192;

export const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";
export const MOONSHOT_DEFAULT_MODEL_ID = "kimi-k2-0905-preview";
export const MOONSHOT_DEFAULT_MODEL_REF = `moonshot/${MOONSHOT_DEFAULT_MODEL_ID}`;
export const MOONSHOT_DEFAULT_CONTEXT_WINDOW = 256000;
export const MOONSHOT_DEFAULT_MAX_TOKENS = 8192;
export const KIMI_CODING_MODEL_ID = "k2p5";
export const KIMI_CODING_MODEL_REF = `kimi-coding/${KIMI_CODING_MODEL_ID}`;

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL_ID = "deepseek-chat";
export const DEEPSEEK_DEFAULT_MODEL_REF = `deepseek/${DEEPSEEK_DEFAULT_MODEL_ID}`;
export const DEEPSEEK_DEFAULT_CONTEXT_WINDOW = 64000;
export const DEEPSEEK_DEFAULT_MAX_TOKENS = 8192;
export const DEEPSEEK_DEFAULT_COST = {
  input: 0.14,
  output: 0.28,
  cacheRead: 0.014,
  cacheWrite: 0.14,
};

export const GROQ_DEFAULT_MODEL_ID = "llama-3.1-70b-versatile";
export const GROQ_DEFAULT_MODEL_REF = `groq/${GROQ_DEFAULT_MODEL_ID}`;

export const MISTRAL_DEFAULT_MODEL_ID = "mistral-large-latest";
export const MISTRAL_DEFAULT_MODEL_REF = `mistral/${MISTRAL_DEFAULT_MODEL_ID}`;

export const CEREBRAS_DEFAULT_MODEL_ID = "llama3.1-70b";
export const CEREBRAS_DEFAULT_MODEL_REF = `cerebras/${CEREBRAS_DEFAULT_MODEL_ID}`;

export const XAI_DEFAULT_MODEL_ID = "grok-beta";
export const XAI_DEFAULT_MODEL_REF = `xai/${XAI_DEFAULT_MODEL_ID}`;

export const XIAOMI_DEFAULT_MODEL_ID = "mimo-v2-flash";
export const XIAOMI_DEFAULT_MODEL_REF = `xiaomi/${XIAOMI_DEFAULT_MODEL_ID}`;

// Pricing: MiniMax doesn't publish public rates. Override in models.json for accurate costs.
export const MINIMAX_API_COST = {
  input: 15,
  output: 60,
  cacheRead: 2,
  cacheWrite: 10,
};
export const MINIMAX_HOSTED_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};
export const MINIMAX_LM_STUDIO_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};
export const MOONSHOT_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const MINIMAX_MODEL_CATALOG = {
  "MiniMax-M2.1": { name: "MiniMax M2.1", reasoning: false },
  "MiniMax-M2.1-lightning": {
    name: "MiniMax M2.1 Lightning",
    reasoning: false,
  },
} as const;

type MinimaxCatalogId = keyof typeof MINIMAX_MODEL_CATALOG;

export function buildMinimaxModelDefinition(params: {
  id: string;
  name?: string;
  reasoning?: boolean;
  cost: ModelDefinitionConfig["cost"];
  contextWindow: number;
  maxTokens: number;
}): ModelDefinitionConfig {
  const catalog = MINIMAX_MODEL_CATALOG[params.id as MinimaxCatalogId];
  return {
    id: params.id,
    name: params.name ?? catalog?.name ?? `MiniMax ${params.id}`,
    reasoning: params.reasoning ?? catalog?.reasoning ?? false,
    input: ["text"],
    cost: params.cost,
    contextWindow: params.contextWindow,
    maxTokens: params.maxTokens,
  };
}

export function buildMinimaxApiModelDefinition(modelId: string): ModelDefinitionConfig {
  return buildMinimaxModelDefinition({
    id: modelId,
    cost: MINIMAX_API_COST,
    contextWindow: DEFAULT_MINIMAX_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MINIMAX_MAX_TOKENS,
  });
}

export function buildMoonshotModelDefinition(): ModelDefinitionConfig {
  return {
    id: MOONSHOT_DEFAULT_MODEL_ID,
    name: "Kimi K2 0905 Preview",
    reasoning: false,
    input: ["text"],
    cost: MOONSHOT_DEFAULT_COST,
    contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
    maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS,
  };
}

export function buildKimiCodingModelDefinition(): ModelDefinitionConfig {
  return {
    id: KIMI_CODING_MODEL_ID,
    name: "Kimi K2.5",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 8192,
  };
}

export function buildDeepseekModelDefinition(): ModelDefinitionConfig {
  return {
    id: DEEPSEEK_DEFAULT_MODEL_ID,
    name: "DeepSeek Chat",
    reasoning: false,
    input: ["text"],
    cost: DEEPSEEK_DEFAULT_COST,
    contextWindow: DEEPSEEK_DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEEPSEEK_DEFAULT_MAX_TOKENS,
  };
}

export function buildGroqModelDefinition(): ModelDefinitionConfig {
  return {
    id: GROQ_DEFAULT_MODEL_ID,
    name: "Llama 3.1 70B Versatile",
    reasoning: false,
    input: ["text"],
    cost: { input: 0.59, output: 0.79, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  };
}

export function buildMistralModelDefinition(): ModelDefinitionConfig {
  return {
    id: MISTRAL_DEFAULT_MODEL_ID,
    name: "Mistral Large Latest",
    reasoning: false,
    input: ["text"],
    cost: { input: 2, output: 6, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  };
}

export function buildCerebrasModelDefinition(): ModelDefinitionConfig {
  return {
    id: CEREBRAS_DEFAULT_MODEL_ID,
    name: "Llama 3.1 70B",
    reasoning: false,
    input: ["text"],
    cost: { input: 0.1, output: 0.1, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 8192,
    maxTokens: 4096,
  };
}

export function buildXaiModelDefinition(): ModelDefinitionConfig {
  return {
    id: XAI_DEFAULT_MODEL_ID,
    name: "Grok Beta",
    reasoning: false,
    input: ["text"],
    cost: { input: 5, output: 15, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  };
}

export function buildXiaomiModelDefinition(): ModelDefinitionConfig {
  return {
    id: XIAOMI_DEFAULT_MODEL_ID,
    name: "Xiaomi Mimo V2 Flash",
    reasoning: false,
    input: ["text"],
    cost: { input: 0.1, output: 0.3, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 262144,
    maxTokens: 8192,
  };
}
