import type { MarketBotConfig } from "../../config/types.js";
import type { LLMProvider } from "../llm.js";
import { MockProvider } from "../llm.js";
import { OpenAICompatibleProvider } from "./openaiCompatible.js";

export function createProviderFromConfig(config: MarketBotConfig): LLMProvider {
  const llm = config.llm ?? {};
  const provider = llm.provider ?? "mock";

  if (provider === "mock") return new MockProvider();

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
