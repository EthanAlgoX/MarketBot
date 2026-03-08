import { OHLC } from "./database.js";

export function calculateWilliamsR(data: OHLC[], period: number = 21): number[] {
  const williamsR: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      williamsR.push(NaN);
      continue;
    }

    let highestHigh = -Infinity;
    let lowestLow = Infinity;

    for (let j = i - period + 1; j <= i; j++) {
      if (data[j].High > highestHigh) highestHigh = data[j].High;
      if (data[j].Low < lowestLow) lowestLow = data[j].Low;
    }

    const diff = highestHigh - lowestLow;
    if (diff === 0) {
      williamsR.push(NaN);
    } else {
      const wr = ((highestHigh - data[i].Close) / diff) * -100;
      williamsR.push(wr);
    }
  }

  return williamsR;
}

export function calculateEMA(data: number[], period: number = 13): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  const initialSMA = sum / period;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(NaN);
    } else if (i === period - 1) {
      ema.push(initialSMA);
    } else {
      const value = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
      ema.push(value);
    }
  }

  return ema;
}

export type WilliamsRInterpretation = "oversold" | "neutral" | "overbought";

export function interpretWilliamsR(value: number): WilliamsRInterpretation {
  if (value <= -80) {
    return "oversold";
  } else if (value >= -20) {
    return "overbought";
  } else {
    return "neutral";
  }
}

if (import.meta.main) {
  const data: OHLC[] = Array.from({ length: 50 }, (_, i) => ({
    Date: new Date(Date.now() - (50 - i) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    Open: 145 + Math.random() * 10,
    High: 150 + Math.random() * 10,
    Low: 140 + Math.random() * 10,
    Close: 145 + Math.random() * 10,
    Volume: Math.floor(Math.random() * 1000000),
  }));

  const wr = calculateWilliamsR(data);
  const closes = data.map((d) => d.Close);
  const ema = calculateEMA(closes);

  console.log(`Latest Williams %R: ${wr[wr.length - 1]?.toFixed(2)}`);
  console.log(`Interpretation: ${interpretWilliamsR(wr[wr.length - 1] ?? 0)}`);
}
