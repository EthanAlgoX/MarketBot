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

export {
  SYNTHETIC_DEFAULT_MODEL_ID,
  SYNTHETIC_DEFAULT_MODEL_REF,
} from "../agents/synthetic-models.js";
export { VENICE_DEFAULT_MODEL_ID, VENICE_DEFAULT_MODEL_REF } from "../agents/venice-models.js";
export {
  applyAuthProfileConfig,
  applyKimiCodeConfig,
  applyKimiCodeProviderConfig,
  applyMoonshotConfig,
  applyMoonshotProviderConfig,
  applyOpenrouterConfig,
  applyOpenrouterProviderConfig,
  applySyntheticConfig,
  applySyntheticProviderConfig,
  applyVeniceConfig,
  applyVeniceProviderConfig,
  applyVercelAiGatewayConfig,
  applyVercelAiGatewayProviderConfig,
  applyXiaomiConfig,
  applyXiaomiProviderConfig,
  applyZaiConfig,
  applyDeepseekConfig,
  applyDeepseekProviderConfig,
  applyGroqConfig,
  applyGroqProviderConfig,
  applyMistralConfig,
  applyMistralProviderConfig,
  applyCerebrasConfig,
  applyCerebrasProviderConfig,
  applyXaiConfig,
  applyXaiProviderConfig,
} from "./onboard-auth.config-core.js";
export {
  applyMinimaxApiConfig,
  applyMinimaxApiProviderConfig,
  applyMinimaxConfig,
  applyMinimaxHostedConfig,
  applyMinimaxHostedProviderConfig,
  applyMinimaxProviderConfig,
} from "./onboard-auth.config-minimax.js";

export {
  applyOpencodeZenConfig,
  applyOpencodeZenProviderConfig,
} from "./onboard-auth.config-opencode.js";
export {
  OPENROUTER_DEFAULT_MODEL_REF,
  setAnthropicApiKey,
  setDeepseekApiKey,
  setGroqApiKey,
  setMistralApiKey,
  setCerebrasApiKey,
  setXaiApiKey,
  setGeminiApiKey,
  setKimiCodingApiKey,
  setMinimaxApiKey,
  setMoonshotApiKey,
  setOpencodeZenApiKey,
  setOpenrouterApiKey,
  setSyntheticApiKey,
  setVeniceApiKey,
  setVercelAiGatewayApiKey,
  setXiaomiApiKey,
  setZaiApiKey,
  DEEPSEEK_DEFAULT_MODEL_REF,
  GROQ_DEFAULT_MODEL_REF,
  MISTRAL_DEFAULT_MODEL_REF,
  CEREBRAS_DEFAULT_MODEL_REF,
  XAI_DEFAULT_MODEL_REF,
  writeOAuthCredentials,
  VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF,
  XIAOMI_DEFAULT_MODEL_REF,
  ZAI_DEFAULT_MODEL_REF,
} from "./onboard-auth.credentials.js";
export {
  buildMinimaxApiModelDefinition,
  buildMinimaxModelDefinition,
  buildMoonshotModelDefinition,
  DEFAULT_MINIMAX_BASE_URL,
  KIMI_CODING_MODEL_ID,
  KIMI_CODING_MODEL_REF,
  MINIMAX_API_BASE_URL,
  MINIMAX_HOSTED_MODEL_ID,
  MINIMAX_HOSTED_MODEL_REF,
  MOONSHOT_BASE_URL,
  MOONSHOT_DEFAULT_MODEL_ID,
  MOONSHOT_DEFAULT_MODEL_REF,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_DEFAULT_MODEL_ID,
  buildDeepseekModelDefinition,
  XIAOMI_DEFAULT_MODEL_ID,
  buildXiaomiModelDefinition,
  GROQ_DEFAULT_MODEL_ID,
  buildGroqModelDefinition,
  MISTRAL_DEFAULT_MODEL_ID,
  buildMistralModelDefinition,
  CEREBRAS_DEFAULT_MODEL_ID,
  buildCerebrasModelDefinition,
  XAI_DEFAULT_MODEL_ID,
  buildXaiModelDefinition,
} from "./onboard-auth.models.js";
