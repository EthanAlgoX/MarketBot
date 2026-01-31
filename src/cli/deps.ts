import { getMarketDataFromIntent } from "../data/marketDataService.js";
import { createProviderFromConfig, createProviderFromConfigAsync } from "../core/providers/registry.js";
import type { MarketBotConfig } from "../config/types.js";
import type { LLMProvider } from "../core/llm.js";

export type CliDeps = {
  createProvider: (config: MarketBotConfig) => LLMProvider;
  createProviderAsync: (config: MarketBotConfig) => Promise<LLMProvider>;
  getMarketDataFromIntent: typeof getMarketDataFromIntent;
};

export function createDefaultDeps(): CliDeps {
  return {
    createProvider: createProviderFromConfig,
    createProviderAsync: createProviderFromConfigAsync,
    getMarketDataFromIntent,
  };
}
