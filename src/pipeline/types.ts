// Pipeline Types - Stock analysis pipeline type definitions

/**
 * Pipeline stages
 */
export enum PipelineStage {
    INIT = "init",
    DATA_FETCH = "data_fetch",
    TREND_ANALYSIS = "trend_analysis",
    INTELLIGENCE = "intelligence",
    LLM_ANALYSIS = "llm_analysis",
    NOTIFICATION = "notification",
    COMPLETE = "complete",
}

/**
 * Asset type
 */
export type AssetType = "stock" | "crypto" | "forex" | "commodity";

/**
 * Pipeline input
 */
export interface PipelineInput {
    symbol: string;
    assetType?: AssetType;
    query?: string;
    options?: {
        enableSearch?: boolean;
        enableNotification?: boolean;
        language?: "zh" | "en";
    };
}

/**
 * Pipeline context - passed through all stages
 */
export interface PipelineContext {
    // Input
    input: PipelineInput;
    requestId: string;
    startTime: number;

    // Stage state
    currentStage: PipelineStage;
    stageResults: Map<PipelineStage, unknown>;

    // Data from stages
    priceData?: {
        current: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        change: number;
        changePercent: number;
    };

    trendAnalysis?: {
        trend: string;
        signal: string;
        score: number;
        maAlignment: string;
        macdSignal: string;
        rsiStatus: string;
        biasWarning?: string;
        buyPrice?: number;
        stopLoss?: number;
        targetPrice?: number;
        checklist: Array<{ item: string; emoji: string }>;
    };

    intelligence?: {
        news: string[];
        sentiment: "bullish" | "bearish" | "neutral";
        keyEvents: string[];
        sources: Array<{ title?: string; url: string }>;
    };

    llmAnalysis?: {
        summary: string;
        keyFindings: string[];
        recommendation: string;
        confidence: number;
    };

    // Errors
    errors: Array<{ stage: PipelineStage; error: string }>;
}

/**
 * Pipeline result
 */
export interface PipelineResult {
    success: boolean;
    symbol: string;

    // Final output
    report: string;
    signal?: "strong_buy" | "buy" | "hold" | "wait" | "sell" | "strong_sell";
    confidence: number;

    // Metadata
    stages: PipelineStage[];
    durationMs: number;
    sources: Array<{ title?: string; url: string }>;
    errors: Array<{ stage: PipelineStage; error: string }>;
}

/**
 * Stage callback for progress reporting
 */
export type StageCallback = (
    stage: PipelineStage,
    status: "start" | "complete" | "error",
    data?: unknown,
) => void;

/**
 * Pipeline options
 */
export interface PipelineOptions {
    onStage?: StageCallback;
    timeout?: number;
    skipStages?: PipelineStage[];
}
