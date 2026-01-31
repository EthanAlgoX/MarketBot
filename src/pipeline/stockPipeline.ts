// Stock Analysis Pipeline - Main orchestrator

import type { LLMProvider } from "../core/llm.js";
import {
    PipelineStage,
    PipelineInput,
    PipelineContext,
    PipelineResult,
    PipelineOptions,
} from "./types.js";
import { webSearch } from "../web/webSearch.js";
import { webFetch } from "../web/webFetch.js";
import { analyzeWebContent, formatAnalysisReport } from "../web/webAnalyze.js";
import { fetchQuoteSnapshot } from "../data/quotes.js";
import { resolveSymbolFromText } from "../utils/symbols.js";
import { NotificationService } from "../notification/service.js";

/**
 * Generate unique ID
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Stock Analysis Pipeline
 * 
 * Flow: 入口 → 数据获取 → 趋势分析 → 情报搜索 → LLM 分析 → 通知
 */
export class StockAnalysisPipeline {
    private provider: LLMProvider;
    private notificationService?: NotificationService;

    constructor(provider: LLMProvider, notificationService?: NotificationService) {
        this.provider = provider;
        this.notificationService = notificationService;
    }

    /**
     * Run the full analysis pipeline
     */
    async run(input: PipelineInput, options: PipelineOptions = {}): Promise<PipelineResult> {
        const ctx: PipelineContext = {
            input,
            requestId: generateId(),
            startTime: Date.now(),
            currentStage: PipelineStage.INIT,
            stageResults: new Map(),
            errors: [],
        };

        const stages: PipelineStage[] = [];

        try {
            // Stage 1: Init
            await this.runStage(ctx, PipelineStage.INIT, options, async () => {
                stages.push(PipelineStage.INIT);
            });

            // Stage 2: Data Fetch (price data)
            if (!options.skipStages?.includes(PipelineStage.DATA_FETCH)) {
                await this.runStage(ctx, PipelineStage.DATA_FETCH, options, async () => {
                    stages.push(PipelineStage.DATA_FETCH);
                    // Price data would come from a market data provider
                    // For now, we skip this as we rely on web search
                });
            }

            // Stage 3: Trend Analysis
            if (!options.skipStages?.includes(PipelineStage.TREND_ANALYSIS)) {
                await this.runStage(ctx, PipelineStage.TREND_ANALYSIS, options, async () => {
                    stages.push(PipelineStage.TREND_ANALYSIS);
                    // Technical analysis would use price data
                    // For now, we rely on LLM to analyze from web data
                });
            }

            // Stage 4: Intelligence (web search)
            if (!options.skipStages?.includes(PipelineStage.INTELLIGENCE)) {
                await this.runStage(ctx, PipelineStage.INTELLIGENCE, options, async () => {
                    stages.push(PipelineStage.INTELLIGENCE);
                    await this.fetchIntelligence(ctx);
                });
            }

            // Stage 5: LLM Analysis
            await this.runStage(ctx, PipelineStage.LLM_ANALYSIS, options, async () => {
                stages.push(PipelineStage.LLM_ANALYSIS);
                await this.runLLMAnalysis(ctx);
            });

            // Stage 6: Notification
            if (input.options?.enableNotification && !options.skipStages?.includes(PipelineStage.NOTIFICATION)) {
                await this.runStage(ctx, PipelineStage.NOTIFICATION, options, async () => {
                    stages.push(PipelineStage.NOTIFICATION);
                    await this.sendNotification(ctx);
                });
            }

            // Complete
            ctx.currentStage = PipelineStage.COMPLETE;
            options.onStage?.(PipelineStage.COMPLETE, "complete");

            return this.buildResult(ctx, stages, true);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            ctx.errors.push({ stage: ctx.currentStage, error: errorMessage });
            return this.buildResult(ctx, stages, false);
        }
    }

    private async runStage(
        ctx: PipelineContext,
        stage: PipelineStage,
        options: PipelineOptions,
        fn: () => Promise<void>,
    ): Promise<void> {
        ctx.currentStage = stage;
        options.onStage?.(stage, "start");

        try {
            await fn();
            options.onStage?.(stage, "complete");
        } catch (error) {
            options.onStage?.(stage, "error", error);
            throw error;
        }
    }

    private async fetchIntelligence(ctx: PipelineContext): Promise<void> {
        const { symbol, query } = ctx.input;

        const resolvedSymbol = resolveSymbolFromText(symbol) ?? symbol;
        let priceSnapshot;
        try {
            priceSnapshot = await fetchQuoteSnapshot(resolvedSymbol);
        } catch (error) {
            console.warn(`Quote fetch failed for ${resolvedSymbol}:`, error);
        }


        const searchQuery = query || `${symbol} stock analysis price news`;

        // Web search
        const searchResults = await webSearch(searchQuery, {
            maxResults: 5,
        });

        // Fetch top pages
        const fetchedPages = [];
        for (const citation of searchResults.citations?.slice(0, 3) || []) {
            try {
                const page = await webFetch(citation);
                if (page) fetchedPages.push(page);
            } catch {
                // Skip failed fetches
            }
        }

        ctx.intelligence = {
            news: searchResults.citations || [],
            sentiment: "neutral",
            keyEvents: [],
            sources: fetchedPages.map(p => ({ title: p.title, url: p.url })),
        };

        ctx.stageResults.set(PipelineStage.INTELLIGENCE, {
            searchResults,
            fetchedPages,
            priceSnapshot,
        });
    }

    private async runLLMAnalysis(ctx: PipelineContext): Promise<void> {
        const { symbol, query } = ctx.input;
        const stageData = ctx.stageResults.get(PipelineStage.INTELLIGENCE) as {
            searchResults: Awaited<ReturnType<typeof webSearch>>;
            fetchedPages: Awaited<ReturnType<typeof webFetch>>[];
            priceSnapshot?: Awaited<ReturnType<typeof fetchQuoteSnapshot>>;
        } | undefined;

        const analysisResult = await analyzeWebContent(this.provider, {
            query: query || `Analyze ${symbol}`,
            searchResults: stageData ? [stageData.searchResults] : undefined,
            fetchedPages: stageData?.fetchedPages,
            priceSnapshot: stageData?.priceSnapshot ?? undefined,
        });

        ctx.llmAnalysis = {
            summary: analysisResult.summary,
            keyFindings: analysisResult.keyFindings,
            recommendation: analysisResult.marketData?.sentiment || "neutral",
            confidence: analysisResult.confidence,
        };

        // Add technical analysis data if available
        if (analysisResult.technicalAnalysis) {
            ctx.trendAnalysis = {
                trend: analysisResult.technicalAnalysis.trend,
                signal: analysisResult.technicalAnalysis.signal,
                score: analysisResult.technicalAnalysis.score,
                maAlignment: analysisResult.technicalAnalysis.maAlignment,
                macdSignal: analysisResult.technicalAnalysis.macdSignal,
                rsiStatus: analysisResult.technicalAnalysis.rsiStatus,
                biasWarning: analysisResult.technicalAnalysis.biasWarning,
                buyPrice: analysisResult.technicalAnalysis.buyPrice,
                stopLoss: analysisResult.technicalAnalysis.stopLoss,
                targetPrice: analysisResult.technicalAnalysis.targetPrice,
                checklist: analysisResult.technicalAnalysis.checklist || [],
            };
        }

        ctx.stageResults.set(PipelineStage.LLM_ANALYSIS, analysisResult);
    }

    private async sendNotification(ctx: PipelineContext): Promise<void> {
        if (!this.notificationService?.isAvailable()) return;

        const analysisResult = ctx.stageResults.get(PipelineStage.LLM_ANALYSIS);
        if (!analysisResult) return;

        const report = formatAnalysisReport(analysisResult as Parameters<typeof formatAnalysisReport>[0]);

        await this.notificationService.sendReport(report, {
            title: `📊 ${ctx.input.symbol} 分析报告`,
        });
    }

    private buildResult(
        ctx: PipelineContext,
        stages: PipelineStage[],
        success: boolean,
    ): PipelineResult {
        const analysisResult = ctx.stageResults.get(PipelineStage.LLM_ANALYSIS) as Parameters<typeof formatAnalysisReport>[0] | undefined;
        const report = analysisResult ? formatAnalysisReport(analysisResult) : "分析失败";

        return {
            success,
            symbol: ctx.input.symbol,
            report,
            signal: ctx.trendAnalysis?.signal as PipelineResult["signal"],
            confidence: ctx.llmAnalysis?.confidence || 0,
            stages,
            durationMs: Date.now() - ctx.startTime,
            sources: ctx.intelligence?.sources || [],
            errors: ctx.errors,
        };
    }
}

/**
 * Create a stock analysis pipeline
 */
export function createStockPipeline(
    provider: LLMProvider,
    notificationService?: NotificationService,
): StockAnalysisPipeline {
    return new StockAnalysisPipeline(provider, notificationService);
}
