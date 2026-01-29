import { getMarketDataFromIntent } from "../data/marketDataService.js";
import { createProviderFromConfig } from "../core/providers/registry.js";
import type { MarketBotConfig } from "../config/types.js";
import type { LLMProvider } from "../core/llm.js";

export type CliDeps = {
  createProvider: (config: MarketBotConfig) => LLMProvider;
  getMarketDataFromIntent: typeof getMarketDataFromIntent;
};

export function createDefaultDeps(): CliDeps {
  return {
    createProvider: createProviderFromConfig,
    getMarketDataFromIntent,
  };
}
