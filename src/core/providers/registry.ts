import type { MarketBotConfig } from "../../config/types.js";
import type { LLMProvider } from "../llm.js";
import { MockProvider } from "../llm.js";
import { OpenAICompatibleProvider } from "./openaiCompatible.js";

import { getCredentials } from "../auth/oauth.js";

export async function createProviderFromConfigAsync(config: MarketBotConfig): Promise<LLMProvider> {
  // 1. Check for OAuth Credentials (Subscriptions) - Priority 1
  const openAiOAuth = await getCredentials("openai-codex");
  if (openAiOAuth && openAiOAuth.access_token) {
    return new OpenAICompatibleProvider({
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: openAiOAuth.access_token,
      model: config.llm?.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      timeoutMs: 30_000,
    });
  }

  const googleOAuth = await getCredentials("google");
  if (googleOAuth && googleOAuth.access_token) {
    // Use Google Gemini via OpenAI Compatible endpoint with OAuth token
    return new OpenAICompatibleProvider({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: googleOAuth.access_token,
      model: "gemini-2.0-flash", // Default for subscription
      timeoutMs: 30_000,
    });
  }

  const llm = config.llm ?? {};

  // 2. If provider is explicitly configured, use it
  if (llm.provider) {
    if (llm.provider === "mock") return new MockProvider();
    return createExplicitProvider(llm);
  }

  // 3. Auto-detect from Environment Variables (Zero-Config Mode)
  // Priority 1: Gemini (Free Tier is popular)
  if (process.env.GEMINI_API_KEY) {
    return new OpenAICompatibleProvider({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-2.0-flash",
      timeoutMs: 30_000,
    });
  }

  // Priority 2: OpenAI / Compatible
  if (process.env.OPENAI_API_KEY) {
    return new OpenAICompatibleProvider({
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      timeoutMs: 30_000,
    });
  }

  // 3. Fallback to Mock
  return new MockProvider();
}

/** @deprecated Use createProviderFromConfigAsync instead */
export function createProviderFromConfig(config: MarketBotConfig): LLMProvider {
  throw new Error("Synchronous createProviderFromConfig is deprecated. Use createProviderFromConfigAsync.");
}

function createExplicitProvider(llm: NonNullable<MarketBotConfig["llm"]>): LLMProvider {
  const provider = llm.provider;

  if (provider === "openai-compatible") {
    const apiKeyEnv = llm.apiKeyEnv ?? "OPENAI_API_KEY";
    const apiKey = llm.apiKey ?? process.env[apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Missing API key for provider ${provider}. Set ${apiKeyEnv}.`);
    }

    const model = llm.model ?? "gpt-4o-mini";
    const baseUrl = llm.baseUrl ?? "https://api.openai.com/v1";

    return new OpenAICompatibleProvider({
      baseUrl,
      apiKey,
      model,
      timeoutMs: llm.timeoutMs ?? 20_000,
      jsonMode: llm.jsonMode ?? false,
      extraHeaders: llm.headers,
    });
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}
