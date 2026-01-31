// Core types for MarketBot market analysis pipeline

// ========== Intent Parsing ==========

export interface IntentParsingOutput {
    asset: string;
    market: "crypto" | "forex" | "stocks" | "commodities";
    analysis_goal: "entry_signal" | "exit_signal" | "risk_check" | "general_analysis";
    timeframes: string[];
    risk_tolerance: "low" | "medium" | "high";
    confidence_level: "exploratory" | "moderate" | "high_conviction";
}

// ========== Market Data ==========

export interface PriceStructure {
    trend_1h: "up" | "down" | "range";
    trend_4h: "up" | "down" | "range";
    trend_1d?: "up" | "down" | "range";
    support_levels?: number[];
    resistance_levels?: number[];
}

export interface Indicators {
    ema_alignment: "bullish" | "bearish" | "neutral";
    rsi_1h?: number;
    rsi_4h?: number;
    macd_signal?: "bullish" | "bearish" | "neutral";
    atr_change: "increasing" | "decreasing" | "stable";
    volume_state: "expanding" | "contracting" | "stable";
    bollinger_position?: "upper" | "middle" | "lower";
}

export interface MarketDataInput {
    price_structure: PriceStructure;
    indicators: Indicators;
    current_price?: number;
    timestamp?: string;
}

// ========== Market Data Interpretation ==========

export interface MarketDataInterpretation {
    market_structure: "trending_up" | "trending_down" | "ranging" | "volatile";
    volatility_state: "high" | "medium" | "low";
    momentum: "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";
    key_levels: {
        nearest_support?: number;
        nearest_resistance?: number;
    };
    summary: string;
}

// ========== Higher Timeframe Bias ==========

export type HigherTimeframeBias = "bullish" | "bearish" | "neutral";

// ========== Market Regime ==========

export interface MarketRegimeInput {
    market_structure: MarketDataInterpretation["market_structure"];
    volatility_state: MarketDataInterpretation["volatility_state"];
    higher_tf_bias: HigherTimeframeBias;
}

export interface MarketRegimeOutput {
    regime: "bull_trend" | "bear_trend" | "accumulation" | "distribution" | "choppy";
    confidence: number;
    recommended_strategy: "trend_following" | "mean_reversion" | "wait" | "hedge";
    rationale: string;
}

// ========== Risk Assessment ==========

export interface RiskAssessmentInput {
    regime: MarketRegimeOutput["regime"];
    volatility_state: MarketDataInterpretation["volatility_state"];
    asset: string;
}

export interface RiskAssessmentOutput {
    risk_level: "low" | "medium" | "high" | "extreme";
    position_size_recommendation: "full" | "half" | "quarter" | "none";
    stop_loss_suggestion: "tight" | "normal" | "wide";
    max_drawdown_warning?: string;
    rationale: string;
}

// ========== Reflection ==========

export interface ReflectionInput {
    intent: IntentParsingOutput;
    market: MarketDataInterpretation;
    regime: MarketRegimeOutput;
    risk: RiskAssessmentOutput;
}

export interface ReflectionOutput {
    confidence_score: number;
    potential_blindspots: string[];
    alternative_scenarios: string[];
    recommendation_strength: "strong" | "moderate" | "weak";
    final_summary: string;
}

// ========== Report ==========

export interface ReportContext {
    intent: IntentParsingOutput;
    market: MarketDataInterpretation;
    regime: MarketRegimeOutput;
    risk: RiskAssessmentOutput;
    reflection: ReflectionOutput;
}
