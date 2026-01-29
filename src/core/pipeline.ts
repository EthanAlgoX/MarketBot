import type { LLMProvider } from "./llm.js";
import type {
  HigherTimeframeBias,
  IntentParsingOutput,
  MarketDataInput,
  MarketDataInterpretation,
  MarketRegimeOutput,
  ReflectionOutput,
  ReportContext,
  RiskAssessmentOutput,
} from "./types.js";
import { runIntentParser } from "../agents/intentParser.js";
import { runMarketDataInterpreter } from "../agents/marketDataInterpreter.js";
import { runMarketRegime } from "../agents/marketRegime.js";
import { runRiskAssessment } from "../agents/riskAssessment.js";
import { runReflection } from "../agents/reflection.js";
import { runReportGenerator } from "../agents/reportGenerator.js";
import { getMarketDataFromIntent, type MarketDataServiceOptions } from "../data/marketDataService.js";
import { getSystemPrompt } from "../agents/systemPrompt.js";

export interface MarketBotInput {
  userQuery: string;
  marketData?: MarketDataInput;
  dataOptions?: MarketDataServiceOptions;
  dataService?: {
    getMarketDataFromIntent: typeof getMarketDataFromIntent;
  };
  agentId?: string;
  cwd?: string;
  higherTimeframeBias?: HigherTimeframeBias;
  provider: LLMProvider;
}

export interface MarketBotOutputs {
  intent: IntentParsingOutput;
  market: MarketDataInterpretation;
  regime: MarketRegimeOutput;
  risk: RiskAssessmentOutput;
  reflection: ReflectionOutput;
  report: string;
}

export async function runMarketBot({
  userQuery,
  marketData,
  dataOptions,
  dataService,
  agentId,
  cwd,
  higherTimeframeBias,
  provider,
}: MarketBotInput): Promise<MarketBotOutputs> {
  const systemPrompt = await getSystemPrompt({ cwd, agentId });
  const intent = await runIntentParser(provider, userQuery, systemPrompt);
  const fetchMarketData = dataService?.getMarketDataFromIntent ?? getMarketDataFromIntent;
  const resolvedMarketData = marketData ?? (await fetchMarketData(intent, dataOptions));
  const market = await runMarketDataInterpreter(provider, resolvedMarketData, systemPrompt);

  const bias = higherTimeframeBias ?? deriveBias(resolvedMarketData);
  const regime = await runMarketRegime(provider, {
    market_structure: market.market_structure,
    volatility_state: market.volatility_state,
    higher_tf_bias: bias,
  }, systemPrompt);

  const risk = await runRiskAssessment(provider, {
    regime: regime.regime,
    volatility_state: market.volatility_state,
    asset: intent.asset,
  }, systemPrompt);

  const reflection = await runReflection(provider, {
    intent,
    market,
    regime,
    risk,
  }, systemPrompt);

  const context: ReportContext = {
    intent,
    market,
    regime,
    risk,
    reflection,
  };

  const report = await runReportGenerator(provider, context, systemPrompt);

  return {
    intent,
    market,
    regime,
    risk,
    reflection,
    report,
  };
}

function deriveBias(marketData: MarketDataInput): HigherTimeframeBias {
  if (marketData.price_structure.trend_4h === "up") return "bullish";
  if (marketData.price_structure.trend_4h === "down") return "bearish";
  return "neutral";
}
