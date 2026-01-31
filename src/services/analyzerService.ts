// Analyzer Service - Unified entry for CLI/HTTP/Bot

import { loadConfig } from "../config/io.js";
import { createProviderFromConfigAsync } from "../core/providers/registry.js";
import { StockAnalysisPipeline, PipelineResult, PipelineStage } from "../pipeline/index.js";
import { NotificationService } from "../notification/service.js";
import { resolveSymbolFromText } from "../utils/symbols.js";

/**
 * Analyzer service options
 */
export interface AnalyzeOptions {
    symbol?: string;
    query?: string;
    enableSearch?: boolean;
    enableNotification?: boolean;
    language?: "zh" | "en";
    onProgress?: (stage: string, status: string) => void;
}

/**
 * Analyzer Service - Unified entry point
 * 
 * Provides a simple interface for:
 * - CLI commands
 * - HTTP API
 * - Bot integrations
 * - Scheduled tasks
 */
export class AnalyzerService {
    private pipeline: StockAnalysisPipeline | null = null;
    private notificationService: NotificationService | null = null;

    /**
     * Initialize the service
     */
    async init(): Promise<void> {
        const config = await loadConfig();
        const provider = await createProviderFromConfigAsync(config);

        // Initialize notification service
        this.notificationService = new NotificationService(config.notification);

        // Create pipeline
        this.pipeline = new StockAnalysisPipeline(provider, this.notificationService);
    }

    /**
     * Analyze a symbol or query
     */
    async analyze(options: AnalyzeOptions): Promise<PipelineResult> {
        if (!this.pipeline) {
            await this.init();
        }

        const symbol = options.symbol || this.extractSymbol(options.query || "");

        // Detect language from query if not provided
        let language = options.language;
        if (!language && options.query) {
            const hasChinese = /[\u4e00-\u9fa5]/.test(options.query);
            language = hasChinese ? "zh" : "en";
        }
        language = language || "zh";

        const result = await this.pipeline!.run({
            symbol,
            query: options.query,
            options: {
                enableSearch: options.enableSearch ?? true,
                enableNotification: options.enableNotification ?? false,
                language: language,
            },
        }, {
            onStage: (stage, status) => {
                options.onProgress?.(stage, status);
            },
        });

        return result;
    }



    /**
     * Check if notification channels are available
     */
    hasNotification(): boolean {
        return this.notificationService?.isAvailable() ?? false;
    }

    /**
     * Get configured notification channels
     */
    getNotificationChannels(): string[] {
        return this.notificationService?.getChannelNames() ?? [];
    }

    /**
     * Extract symbol from query
     */
    private extractSymbol(query: string): string {
        const resolved = resolveSymbolFromText(query);
        if (resolved) return resolved;

        return "UNKNOWN";
    }
}

/**
 * Create analyzer service instance
 */
export async function createAnalyzerService(): Promise<AnalyzerService> {
    const service = new AnalyzerService();
    await service.init();
    return service;
}

/**
 * Quick analyze function for simple use cases
 */
export async function quickAnalyze(query: string): Promise<PipelineResult> {
    const service = await createAnalyzerService();
    return service.analyze({ query });
}
