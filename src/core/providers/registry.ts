import type { MarketBotConfig } from "../../config/types.js";
import type { LLMProvider } from "../llm.js";
import { MockProvider } from "../llm.js";
import { OpenAICompatibleProvider } from "./openaiCompatible.js";

export function createProviderFromConfig(config: MarketBotConfig): LLMProvider {
  const llm = config.llm ?? {};

  // 1. If provider is explicitly configured, use it
  if (llm.provider && llm.provider !== "mock") {
    return createExplicitProvider(llm);
  }

  // 2. Auto-detect from Environment Variables (Zero-Config Mode)
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
