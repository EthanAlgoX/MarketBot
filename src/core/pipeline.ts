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
  MarketBotRunPhase,
  MarketBotRunPhaseEvent,
  MarketBotRunPhaseResult,
  MarketBotRunTrace,
} from "./types.js";
import type { SessionStore } from "../session/store.js";
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
  includeTrace?: boolean;
  onPhase?: (event: MarketBotRunPhaseEvent) => void;
  session?: {
    key?: string;
    store?: SessionStore;
    includeContext?: boolean;
  };
}

export interface MarketBotOutputs {
  intent: IntentParsingOutput;
  market: MarketDataInterpretation;
  regime: MarketRegimeOutput;
  risk: RiskAssessmentOutput;
  reflection: ReflectionOutput;
  report: string;
  trace?: MarketBotRunTrace;
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
  includeTrace,
  onPhase,
  session,
}: MarketBotInput): Promise<MarketBotOutputs> {
  const runStartedAt = new Date();
  let systemPrompt = await getSystemPrompt({ cwd, agentId });

  const sessionStore = session?.store;
  const sessionKey = sessionStore ? session?.key?.trim() || "main" : undefined;
  if (sessionStore && sessionKey && session?.includeContext !== false) {
    const sessionContext = await sessionStore.buildContext(sessionKey);
    if (sessionContext) {
      systemPrompt = `${systemPrompt}\n\n${sessionContext}`;
    }
  }

  const phases: MarketBotRunPhaseResult[] = [];
  const recordTrace = Boolean(includeTrace);

  const runPhase = async <T>(phase: MarketBotRunPhase, fn: () => Promise<T>): Promise<T> => {
    const startedAt = new Date();
    const startedAtIso = startedAt.toISOString();
    onPhase?.({ phase, status: "start", startedAt: startedAtIso });
    try {
      const result = await fn();
      const endedAt = new Date();
      const endedAtIso = endedAt.toISOString();
      const durationMs = endedAt.getTime() - startedAt.getTime();
      if (recordTrace) {
        phases.push({ phase, startedAt: startedAtIso, endedAt: endedAtIso, durationMs, ok: true });
      }
      onPhase?.({ phase, status: "end", startedAt: startedAtIso, endedAt: endedAtIso, durationMs, detail: result });
      return result;
    } catch (err) {
      const endedAt = new Date();
      const endedAtIso = endedAt.toISOString();
      const durationMs = endedAt.getTime() - startedAt.getTime();
      const error = toErrorMessage(err);
      if (recordTrace) {
        phases.push({ phase, startedAt: startedAtIso, endedAt: endedAtIso, durationMs, ok: false, error });
      }
      onPhase?.({ phase, status: "error", startedAt: startedAtIso, endedAt: endedAtIso, durationMs, error });
      throw err;
    }
  };

  const intent = await runPhase("intent", () => runIntentParser(provider, userQuery, systemPrompt));
  const fetchMarketData = dataService?.getMarketDataFromIntent ?? getMarketDataFromIntent;
  const resolvedMarketData = await runPhase("market_data", async () => {
    if (marketData) return marketData;
    return fetchMarketData(intent, dataOptions);
  });
  const market = await runPhase("interpret", () => runMarketDataInterpreter(provider, resolvedMarketData, systemPrompt));

  const bias = higherTimeframeBias ?? deriveBias(resolvedMarketData);
  const regime = await runPhase("regime", () =>
    runMarketRegime(
      provider,
      {
        market_structure: market.market_structure,
        volatility_state: market.volatility_state,
        higher_tf_bias: bias,
      },
      systemPrompt,
    ),
  );

  const risk = await runPhase("risk", () =>
    runRiskAssessment(
      provider,
      {
        regime: regime.regime,
        volatility_state: market.volatility_state,
        asset: intent.asset,
      },
      systemPrompt,
    ),
  );

  const reflection = await runPhase("reflection", () =>
    runReflection(
      provider,
      {
        intent,
        market,
        regime,
        risk,
      },
      systemPrompt,
    ),
  );

  const context: ReportContext = {
    intent,
    market,
    regime,
    risk,
    reflection,
  };

  const report = await runPhase("report", () => runReportGenerator(provider, context, systemPrompt));

  if (sessionStore && sessionKey) {
    const now = new Date().toISOString();
    const summary = reflection.final_summary || report;
    await sessionStore.append(
      sessionKey,
      [
        { ts: now, type: "user", content: userQuery },
        { ts: now, type: "summary", content: summary },
      ],
      summary,
    );
  }

  const runEndedAt = new Date();
  const trace = recordTrace
    ? {
        startedAt: runStartedAt.toISOString(),
        endedAt: runEndedAt.toISOString(),
        phases,
      }
    : undefined;

  return {
    intent,
    market,
    regime,
    risk,
    reflection,
    report,
    trace,
  };
}

function deriveBias(marketData: MarketDataInput): HigherTimeframeBias {
  if (marketData.price_structure.trend_4h === "up") return "bullish";
  if (marketData.price_structure.trend_4h === "down") return "bearish";
  return "neutral";
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
