// Trend Analyzer - Comprehensive stock trend analysis

import {
    CandleData,
    MAResult,
    MACDResult,
    RSIResult,
    BIASResult,
    VolumeResult,
    calculateMA,
    calculateMACD,
    calculateRSI,
    calculateBIAS,
    analyzeVolume,
} from "./indicators.js";

/**
 * 趋势状态
 */
export enum TrendStatus {
    STRONG_BULL = "强势多头",
    BULL = "多头排列",
    WEAK_BULL = "弱势多头",
    CONSOLIDATION = "盘整",
    WEAK_BEAR = "弱势空头",
    BEAR = "空头排列",
    STRONG_BEAR = "强势空头",
}

/**
 * 买入信号
 */
export enum BuySignal {
    STRONG_BUY = "强烈买入",
    BUY = "买入",
    HOLD = "持有",
    WAIT = "观望",
    SELL = "卖出",
    STRONG_SELL = "强烈卖出",
}

/**
 * 综合分析结果
 */
export interface TrendAnalysisResult {
    // 基础信息
    symbol: string;
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;

    // 均线分析
    ma: MAResult;

    // MACD 分析
    macd: MACDResult;

    // RSI 分析
    rsi: RSIResult;

    // 乖离率
    bias: BIASResult;

    // 量能分析
    volume: VolumeResult;

    // 综合判断
    trendStatus: TrendStatus;
    buySignal: BuySignal;
    signalScore: number; // -100 to 100

    // 买卖点位
    buyPrice: number | null;
    stopLoss: number | null;
    targetPrice: number | null;

    // 信号原因和风险
    signalReasons: string[];
    riskFactors: string[];

    // 检查清单
    checklist: {
        item: string;
        passed: boolean | null; // null = 中性
        emoji: string;
    }[];
}

/**
 * 趋势分析器
 */
export class TrendAnalyzer {
    /**
     * 分析股票趋势
     */
    analyze(candles: CandleData[], symbol: string): TrendAnalysisResult {
        if (candles.length < 5) {
            return this.createEmptyResult(symbol);
        }

        const currentPrice = candles[candles.length - 1].close;
        const prevPrice = candles.length > 1 ? candles[candles.length - 2].close : currentPrice;
        const priceChange = currentPrice - prevPrice;
        const priceChangePercent = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0;

        // 计算各项指标
        const ma = calculateMA(candles);
        const macd = calculateMACD(candles);
        const rsi = calculateRSI(candles);
        const bias = calculateBIAS(candles);
        const volume = analyzeVolume(candles);

        // 趋势判断
        const trendStatus = this.determineTrendStatus(ma, macd, rsi);

        // 综合评分和信号
        const { score, reasons, risks } = this.calculateSignalScore(ma, macd, rsi, bias, volume);
        const buySignal = this.determineBuySignal(score, bias);

        // 计算买卖点位
        const { buyPrice, stopLoss, targetPrice } = this.calculatePriceTargets(currentPrice, ma);

        // 生成检查清单
        const checklist = this.generateChecklist(ma, macd, rsi, bias, volume);

        return {
            symbol,
            currentPrice,
            priceChange,
            priceChangePercent,
            ma,
            macd,
            rsi,
            bias,
            volume,
            trendStatus,
            buySignal,
            signalScore: score,
            buyPrice,
            stopLoss,
            targetPrice,
            signalReasons: reasons,
            riskFactors: risks,
            checklist,
        };
    }

    private determineTrendStatus(ma: MAResult, macd: MACDResult, rsi: RSIResult): TrendStatus {
        const bullScore =
            (ma.maAlignment === "bullish" ? 2 : ma.maAlignment === "bearish" ? -2 : 0) +
            (macd.signal === "golden_cross" || macd.signal === "bullish" ? 1 : macd.signal === "death_cross" || macd.signal === "bearish" ? -1 : 0) +
            (rsi.status === "strong" ? 1 : rsi.status === "weak" ? -1 : 0);

        if (bullScore >= 3) return TrendStatus.STRONG_BULL;
        if (bullScore === 2) return TrendStatus.BULL;
        if (bullScore === 1) return TrendStatus.WEAK_BULL;
        if (bullScore === -1) return TrendStatus.WEAK_BEAR;
        if (bullScore === -2) return TrendStatus.BEAR;
        if (bullScore <= -3) return TrendStatus.STRONG_BEAR;
        return TrendStatus.CONSOLIDATION;
    }

    private calculateSignalScore(
        ma: MAResult,
        macd: MACDResult,
        rsi: RSIResult,
        bias: BIASResult,
        volume: VolumeResult,
    ): { score: number; reasons: string[]; risks: string[] } {
        let score = 0;
        const reasons: string[] = [];
        const risks: string[] = [];

        // 均线排列 (+/-30)
        if (ma.maAlignment === "bullish") {
            score += 30;
            reasons.push("均线多头排列");
        } else if (ma.maAlignment === "bearish") {
            score -= 30;
            risks.push("均线空头排列");
        }

        // MACD 信号 (+/-25)
        if (macd.signal === "golden_cross") {
            score += 25;
            reasons.push(macd.aboveZero ? "零轴上金叉（强信号）" : "金叉");
        } else if (macd.signal === "death_cross") {
            score -= 25;
            risks.push("MACD死叉");
        } else if (macd.signal === "bullish") {
            score += 15;
            reasons.push("MACD多头");
        } else if (macd.signal === "bearish") {
            score -= 15;
            risks.push("MACD空头");
        }

        // RSI (+/-20)
        if (rsi.status === "strong") {
            score += 15;
            reasons.push("RSI强势区域");
        } else if (rsi.status === "overbought") {
            score -= 10;
            risks.push("RSI超买，注意回调");
        } else if (rsi.status === "oversold") {
            score += 10;
            reasons.push("RSI超卖，有反弹空间");
        } else if (rsi.status === "weak") {
            score -= 15;
            risks.push("RSI弱势");
        }

        // 乖离率 (+/-15)
        if (!bias.isSafe && bias.bias5 > 5) {
            score -= 20;
            risks.push(`乖离率${bias.bias5.toFixed(1)}%超过警戒线，严禁追高`);
        } else if (bias.isSafe && bias.bias5 > 0 && bias.bias5 < 3) {
            score += 10;
            reasons.push("乖离率安全区间");
        }

        // 量能 (+/-10)
        if (volume.status === "shrink_down") {
            score += 10;
            reasons.push("缩量回调（最佳买点）");
        } else if (volume.status === "heavy_up") {
            score += 5;
            reasons.push("放量上涨");
        } else if (volume.status === "heavy_down") {
            score -= 10;
            risks.push("放量下跌");
        }

        return { score: Math.max(-100, Math.min(100, score)), reasons, risks };
    }

    private determineBuySignal(score: number, bias: BIASResult): BuySignal {
        // 乖离率过高直接观望
        if (!bias.isSafe && bias.bias5 > 5) {
            return BuySignal.WAIT;
        }

        if (score >= 60) return BuySignal.STRONG_BUY;
        if (score >= 30) return BuySignal.BUY;
        if (score >= 10) return BuySignal.HOLD;
        if (score >= -20) return BuySignal.WAIT;
        if (score >= -50) return BuySignal.SELL;
        return BuySignal.STRONG_SELL;
    }

    private calculatePriceTargets(
        currentPrice: number,
        ma: MAResult,
    ): { buyPrice: number | null; stopLoss: number | null; targetPrice: number | null } {
        if (ma.maAlignment !== "bullish") {
            return { buyPrice: null, stopLoss: null, targetPrice: null };
        }

        // 买入价：MA5 附近
        const buyPrice = Math.round(ma.ma5 * 100) / 100;

        // 止损价：MA10 下方 2%
        const stopLoss = Math.round(ma.ma10 * 0.98 * 100) / 100;

        // 目标价：当前价向上 8-10%
        const targetPrice = Math.round(currentPrice * 1.08 * 100) / 100;

        return { buyPrice, stopLoss, targetPrice };
    }

    private generateChecklist(
        ma: MAResult,
        macd: MACDResult,
        rsi: RSIResult,
        bias: BIASResult,
        volume: VolumeResult,
    ): TrendAnalysisResult["checklist"] {
        return [
            {
                item: "多头排列 (MA5>MA10>MA20)",
                passed: ma.maAlignment === "bullish" ? true : ma.maAlignment === "bearish" ? false : null,
                emoji: ma.maAlignment === "bullish" ? "✅" : ma.maAlignment === "bearish" ? "❌" : "⚠️",
            },
            {
                item: "MACD 金叉或多头",
                passed: macd.signal === "golden_cross" || macd.signal === "bullish" ? true : macd.signal === "death_cross" || macd.signal === "bearish" ? false : null,
                emoji: macd.signal === "golden_cross" || macd.signal === "bullish" ? "✅" : macd.signal === "death_cross" || macd.signal === "bearish" ? "❌" : "⚠️",
            },
            {
                item: "乖离率安全 (<5%)",
                passed: bias.isSafe,
                emoji: bias.isSafe ? "✅" : "❌",
            },
            {
                item: "RSI 非超买",
                passed: rsi.status !== "overbought",
                emoji: rsi.status === "overbought" ? "❌" : "✅",
            },
            {
                item: "量能配合",
                passed: volume.status === "shrink_down" || volume.status === "heavy_up" ? true : volume.status === "heavy_down" ? false : null,
                emoji: volume.status === "shrink_down" || volume.status === "heavy_up" ? "✅" : volume.status === "heavy_down" ? "❌" : "⚠️",
            },
        ];
    }

    private createEmptyResult(symbol: string): TrendAnalysisResult {
        return {
            symbol,
            currentPrice: 0,
            priceChange: 0,
            priceChangePercent: 0,
            ma: { ma5: 0, ma10: 0, ma20: 0, ma60: 0, maAlignment: "mixed", alignmentStrength: 0 },
            macd: { dif: 0, dea: 0, macd: 0, signal: "neutral", aboveZero: false },
            rsi: { rsi6: 50, rsi14: 50, status: "neutral" },
            bias: { bias5: 0, bias10: 0, bias20: 0, isSafe: true, warning: null },
            volume: { avgVolume5: 0, avgVolume20: 0, volumeRatio: 1, status: "normal" },
            trendStatus: TrendStatus.CONSOLIDATION,
            buySignal: BuySignal.WAIT,
            signalScore: 0,
            buyPrice: null,
            stopLoss: null,
            targetPrice: null,
            signalReasons: [],
            riskFactors: [],
            checklist: [],
        };
    }
}

/**
 * 格式化分析结果为决策仪表盘
 */
export function formatDecisionDashboard(result: TrendAnalysisResult): string {
    const signalEmoji = {
        [BuySignal.STRONG_BUY]: "🟢",
        [BuySignal.BUY]: "🟢",
        [BuySignal.HOLD]: "🟡",
        [BuySignal.WAIT]: "🟡",
        [BuySignal.SELL]: "🔴",
        [BuySignal.STRONG_SELL]: "🔴",
    };

    const emoji = signalEmoji[result.buySignal];
    const lines: string[] = [];

    lines.push(`${emoji} **${result.buySignal}** | ${result.symbol}`);
    lines.push("");

    // 价格信息
    const changeEmoji = result.priceChangePercent >= 0 ? "📈" : "📉";
    lines.push(`${changeEmoji} 当前价: ${result.currentPrice.toFixed(2)} (${result.priceChangePercent >= 0 ? "+" : ""}${result.priceChangePercent.toFixed(2)}%)`);
    lines.push(`📊 趋势: ${result.trendStatus}`);
    lines.push("");

    // 核心结论
    if (result.signalReasons.length > 0) {
        lines.push(`📌 ${result.signalReasons.slice(0, 2).join("，")}`);
    }

    // 买卖点位
    if (result.buyPrice || result.stopLoss || result.targetPrice) {
        lines.push("");
        lines.push(`💰 狙击: 买入${result.buyPrice} | 止损${result.stopLoss} | 目标${result.targetPrice}`);
    }

    // 检查清单
    if (result.checklist.length > 0) {
        lines.push("");
        lines.push(result.checklist.map(c => `${c.emoji}${c.item.split(" ")[0]}`).join(" "));
    }

    // 风险提示
    if (result.riskFactors.length > 0) {
        lines.push("");
        lines.push(`⚠️ ${result.riskFactors[0]}`);
    }

    return lines.join("\n");
}
