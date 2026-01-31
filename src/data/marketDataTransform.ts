// Transform raw market series data into analysis-ready format

import type { MarketDataInput, PriceStructure, Indicators } from "../core/types.js";
import type { MarketSeries, Candle } from "./types.js";

/**
 * Transform raw OHLCV series data into MarketDataInput format.
 */
export function transformSeriesToMarketData(series: MarketSeries[]): MarketDataInput {
    const series1h = series.find((s) => s.timeframe === "1h");
    const series4h = series.find((s) => s.timeframe === "4h");
    const series1d = series.find((s) => s.timeframe === "1d");

    const candles1h = series1h?.candles ?? [];
    const candles4h = series4h?.candles ?? [];
    const candles1d = series1d?.candles ?? [];

    const priceStructure = computePriceStructure(candles1h, candles4h, candles1d);
    const indicators = computeIndicators(candles1h, candles4h);

    const latestCandle = candles1h[candles1h.length - 1] ?? candles4h[candles4h.length - 1];

    return {
        price_structure: priceStructure,
        indicators,
        current_price: latestCandle?.close,
        timestamp: new Date().toISOString(),
    };
}

function computePriceStructure(
    candles1h: Candle[],
    candles4h: Candle[],
    candles1d: Candle[]
): PriceStructure {
    return {
        trend_1h: detectTrend(candles1h),
        trend_4h: detectTrend(candles4h),
        trend_1d: candles1d.length > 0 ? detectTrend(candles1d) : undefined,
        support_levels: findSupportLevels(candles1h),
        resistance_levels: findResistanceLevels(candles1h),
    };
}

function computeIndicators(candles1h: Candle[], candles4h: Candle[]): Indicators {
    const rsi1h = calculateRsi(candles1h);
    const rsi4h = calculateRsi(candles4h);
    const emaAlignment = detectEmaAlignment(candles1h);
    const atrChange = detectAtrChange(candles1h);
    const volumeState = detectVolumeState(candles1h);

    return {
        ema_alignment: emaAlignment,
        rsi_1h: rsi1h,
        rsi_4h: rsi4h,
        macd_signal: "neutral",
        atr_change: atrChange,
        volume_state: volumeState,
        bollinger_position: "middle",
    };
}

function detectTrend(candles: Candle[]): "up" | "down" | "range" {
    if (candles.length < 3) return "range";

    const recentCandles = candles.slice(-10);
    const closes = recentCandles.map((c) => c.close);
    const firstHalf = closes.slice(0, Math.floor(closes.length / 2));
    const secondHalf = closes.slice(Math.floor(closes.length / 2));

    const firstAvg = average(firstHalf);
    const secondAvg = average(secondHalf);
    const diff = (secondAvg - firstAvg) / firstAvg;

    if (diff > 0.01) return "up";
    if (diff < -0.01) return "down";
    return "range";
}

function detectEmaAlignment(candles: Candle[]): "bullish" | "bearish" | "neutral" {
    if (candles.length < 20) return "neutral";

    const closes = candles.map((c) => c.close);
    const ema9 = calculateEma(closes, 9);
    const ema21 = calculateEma(closes, 21);

    if (ema9 > ema21 * 1.005) return "bullish";
    if (ema9 < ema21 * 0.995) return "bearish";
    return "neutral";
}

function calculateEma(values: number[], period: number): number {
    if (values.length < period) return values[values.length - 1] ?? 0;

    const k = 2 / (period + 1);
    let ema = average(values.slice(0, period));

    for (let i = period; i < values.length; i++) {
        ema = values[i] * k + ema * (1 - k);
    }

    return ema;
}

function calculateRsi(candles: Candle[], period: number = 14): number | undefined {
    if (candles.length < period + 1) return undefined;

    const changes = [];
    for (let i = 1; i < candles.length; i++) {
        changes.push(candles[i].close - candles[i - 1].close);
    }

    const recentChanges = changes.slice(-period);
    const gains = recentChanges.filter((c) => c > 0);
    const losses = recentChanges.filter((c) => c < 0).map((c) => Math.abs(c));

    const avgGain = gains.length > 0 ? average(gains) : 0;
    const avgLoss = losses.length > 0 ? average(losses) : 0.0001;

    const rs = avgGain / avgLoss;
    return Math.round(100 - 100 / (1 + rs));
}

function detectAtrChange(candles: Candle[]): "increasing" | "decreasing" | "stable" {
    if (candles.length < 20) return "stable";

    const atrRecent = calculateAtr(candles.slice(-10));
    const atrPrevious = calculateAtr(candles.slice(-20, -10));

    if (!atrRecent || !atrPrevious) return "stable";

    const change = (atrRecent - atrPrevious) / atrPrevious;
    if (change > 0.1) return "increasing";
    if (change < -0.1) return "decreasing";
    return "stable";
}

function calculateAtr(candles: Candle[]): number | undefined {
    if (candles.length < 2) return undefined;

    const trValues = [];
    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trValues.push(tr);
    }

    return average(trValues);
}

function detectVolumeState(candles: Candle[]): "expanding" | "contracting" | "stable" {
    if (candles.length < 20) return "stable";

    const recentVolume = average(candles.slice(-5).map((c) => c.volume));
    const previousVolume = average(candles.slice(-20, -5).map((c) => c.volume));

    if (previousVolume === 0) return "stable";

    const change = (recentVolume - previousVolume) / previousVolume;
    if (change > 0.2) return "expanding";
    if (change < -0.2) return "contracting";
    return "stable";
}

function findSupportLevels(candles: Candle[]): number[] {
    if (candles.length < 10) return [];

    const lows = candles.map((c) => c.low);
    const minLow = Math.min(...lows);
    const currentLow = lows[lows.length - 1];

    return [Math.round(currentLow * 0.98 * 100) / 100, Math.round(minLow * 100) / 100];
}

function findResistanceLevels(candles: Candle[]): number[] {
    if (candles.length < 10) return [];

    const highs = candles.map((c) => c.high);
    const maxHigh = Math.max(...highs);
    const currentHigh = highs[highs.length - 1];

    return [Math.round(currentHigh * 1.02 * 100) / 100, Math.round(maxHigh * 100) / 100];
}

function average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}
