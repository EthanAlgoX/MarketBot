// Technical Indicators - MA, MACD, RSI, BIAS calculations

/**
 * Candle data for technical analysis
 */
export interface CandleData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Moving Average result
 */
export interface MAResult {
    ma5: number;
    ma10: number;
    ma20: number;
    ma60: number;
    maAlignment: "bullish" | "bearish" | "mixed";
    alignmentStrength: number; // 0-100
}

/**
 * MACD indicator result
 */
export interface MACDResult {
    dif: number;
    dea: number;
    macd: number; // histogram
    signal: "golden_cross" | "death_cross" | "bullish" | "bearish" | "neutral";
    aboveZero: boolean;
}

/**
 * RSI indicator result
 */
export interface RSIResult {
    rsi6: number;
    rsi14: number;
    status: "overbought" | "strong" | "neutral" | "weak" | "oversold";
}

/**
 * BIAS (乖离率) result
 */
export interface BIASResult {
    bias5: number;  // 偏离 MA5 百分比
    bias10: number;
    bias20: number;
    isSafe: boolean; // 乖离率 < 5% 安全
    warning: string | null;
}

/**
 * Volume analysis result
 */
export interface VolumeResult {
    avgVolume5: number;
    avgVolume20: number;
    volumeRatio: number; // 当前成交量 / 5日均量
    status: "heavy_up" | "heavy_down" | "shrink_up" | "shrink_down" | "normal";
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
        ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
}

/**
 * Calculate all Moving Averages
 */
export function calculateMA(candles: CandleData[]): MAResult {
    const closes = candles.map(c => c.close);
    const ma5 = calculateSMA(closes, 5);
    const ma10 = calculateSMA(closes, 10);
    const ma20 = calculateSMA(closes, 20);
    const ma60 = calculateSMA(closes, 60);

    // 判断均线排列
    let maAlignment: "bullish" | "bearish" | "mixed" = "mixed";
    let alignmentStrength = 0;

    if (ma5 > ma10 && ma10 > ma20) {
        maAlignment = "bullish";
        alignmentStrength = Math.min(100, ((ma5 - ma20) / ma20) * 1000);
    } else if (ma5 < ma10 && ma10 < ma20) {
        maAlignment = "bearish";
        alignmentStrength = Math.min(100, ((ma20 - ma5) / ma20) * 1000);
    }

    return { ma5, ma10, ma20, ma60, maAlignment, alignmentStrength };
}

/**
 * Calculate MACD indicator
 * DIF = EMA(12) - EMA(26)
 * DEA = EMA(DIF, 9)
 * MACD = (DIF - DEA) * 2
 */
export function calculateMACD(candles: CandleData[]): MACDResult {
    const closes = candles.map(c => c.close);

    if (closes.length < 26) {
        return { dif: 0, dea: 0, macd: 0, signal: "neutral", aboveZero: false };
    }

    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    const dif = ema12 - ema26;

    // Calculate DEA (EMA of DIF values)
    // Simplified: use current DIF as approximation
    const difValues: number[] = [];
    for (let i = 26; i <= closes.length; i++) {
        const slice = closes.slice(0, i);
        const e12 = calculateEMA(slice, 12);
        const e26 = calculateEMA(slice, 26);
        difValues.push(e12 - e26);
    }

    const dea = difValues.length >= 9 ? calculateEMA(difValues, 9) : dif;
    const macd = (dif - dea) * 2;

    // Determine signal
    let signal: MACDResult["signal"] = "neutral";
    const prevDif = difValues.length > 1 ? difValues[difValues.length - 2] : 0;
    const prevDea = difValues.length > 9 ? calculateEMA(difValues.slice(0, -1), 9) : prevDif;

    if (prevDif < prevDea && dif > dea) {
        signal = "golden_cross";
    } else if (prevDif > prevDea && dif < dea) {
        signal = "death_cross";
    } else if (dif > dea && dif > 0) {
        signal = "bullish";
    } else if (dif < dea && dif < 0) {
        signal = "bearish";
    }

    return { dif, dea, macd, signal, aboveZero: dif > 0 };
}

/**
 * Calculate RSI indicator
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 */
export function calculateRSI(candles: CandleData[]): RSIResult {
    const closes = candles.map(c => c.close);

    const calculate = (period: number): number => {
        if (closes.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = closes.length - period; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    };

    const rsi6 = calculate(6);
    const rsi14 = calculate(14);

    // Determine status based on RSI14
    let status: RSIResult["status"] = "neutral";
    if (rsi14 > 70) status = "overbought";
    else if (rsi14 > 60) status = "strong";
    else if (rsi14 < 30) status = "oversold";
    else if (rsi14 < 40) status = "weak";

    return { rsi6, rsi14, status };
}

/**
 * Calculate BIAS (乖离率)
 * BIAS = (现价 - MA) / MA * 100%
 */
export function calculateBIAS(candles: CandleData[]): BIASResult {
    const closes = candles.map(c => c.close);
    const currentPrice = closes[closes.length - 1] || 0;

    const ma5 = calculateSMA(closes, 5);
    const ma10 = calculateSMA(closes, 10);
    const ma20 = calculateSMA(closes, 20);

    const bias5 = ma5 > 0 ? ((currentPrice - ma5) / ma5) * 100 : 0;
    const bias10 = ma10 > 0 ? ((currentPrice - ma10) / ma10) * 100 : 0;
    const bias20 = ma20 > 0 ? ((currentPrice - ma20) / ma20) * 100 : 0;

    // 乖离率超过 5% 警告
    const isSafe = Math.abs(bias5) < 5;
    let warning: string | null = null;

    if (bias5 > 5) {
        warning = `乖离率 ${bias5.toFixed(1)}% 超过5%警戒线，严禁追高`;
    } else if (bias5 < -5) {
        warning = `乖离率 ${bias5.toFixed(1)}%，偏离过大，注意风险`;
    }

    return { bias5, bias10, bias20, isSafe, warning };
}

/**
 * Analyze volume patterns
 */
export function analyzeVolume(candles: CandleData[]): VolumeResult {
    if (candles.length < 5) {
        return { avgVolume5: 0, avgVolume20: 0, volumeRatio: 1, status: "normal" };
    }

    const volumes = candles.map(c => c.volume);
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume5 = calculateSMA(volumes, 5);
    const avgVolume20 = candles.length >= 20 ? calculateSMA(volumes, 20) : avgVolume5;
    const volumeRatio = avgVolume5 > 0 ? currentVolume / avgVolume5 : 1;

    // 判断量能状态
    const priceChange = candles.length > 1
        ? candles[candles.length - 1].close - candles[candles.length - 2].close
        : 0;

    let status: VolumeResult["status"] = "normal";

    if (volumeRatio > 1.5 && priceChange > 0) {
        status = "heavy_up"; // 放量上涨
    } else if (volumeRatio > 1.5 && priceChange < 0) {
        status = "heavy_down"; // 放量下跌
    } else if (volumeRatio < 0.7 && priceChange > 0) {
        status = "shrink_up"; // 缩量上涨
    } else if (volumeRatio < 0.7 && priceChange < 0) {
        status = "shrink_down"; // 缩量回调 (最佳买点)
    }

    return { avgVolume5, avgVolume20, volumeRatio, status };
}
