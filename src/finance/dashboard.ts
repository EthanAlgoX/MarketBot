/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { sma } from "./indicators.js";
import type { MarketSeries, NewsItem, Quote, RiskMetrics, TechnicalSummary } from "./types.js";

export type DecisionLevel = "buy" | "watch" | "sell";

export type DecisionDashboard = {
  symbol: string;
  asOfIso?: string;
  price?: number;
  currency?: string;

  // Core conclusion (dashboard headline)
  oneSentence: string;
  level: DecisionLevel;
  confidence: "high" | "medium" | "low";

  // Action plan
  entry?: number;
  stopLoss?: number;
  target1?: number;
  target2?: number;

  // Key levels
  support?: number;
  resistance?: number;

  // Diagnostics (rule-based, deterministic)
  checklist: Array<{ key: string; status: "ok" | "warn" | "bad"; detail: string }>;

  // Evidence (for transparency)
  technicals?: Pick<
    TechnicalSummary,
    "timeframe" | "trend" | "rsi" | "sma" | "ema" | "atr" | "volatility" | "support" | "resistance"
  >;
  risk?: Pick<RiskMetrics, "timeframe" | "volatility" | "maxDrawdown" | "valueAtRisk95">;
  news?: Array<Pick<NewsItem, "title" | "pubDate" | "link">>;
};

function clampFinite(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function pct(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
    return null;
  }
  return (a - b) / b;
}

function fmtPct(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function biasPct(price: number | undefined, ma: number | undefined): number | null {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    return null;
  }
  if (typeof ma !== "number" || !Number.isFinite(ma) || ma === 0) {
    return null;
  }
  return (price - ma) / ma;
}

function pickAsOfIso(series: MarketSeries, quote?: Quote): string | undefined {
  if (quote?.regularMarketTime) {
    return new Date(quote.regularMarketTime).toISOString();
  }
  const last = series.series.at(-1);
  return last?.iso;
}

function round2(n: number | undefined): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return undefined;
  }
  return Math.round(n * 100) / 100;
}

export function buildDecisionDashboard(params: {
  symbol: string;
  series: MarketSeries;
  quote?: Quote;
  technicals: TechnicalSummary;
  risk: RiskMetrics;
  news?: NewsItem[];
}): DecisionDashboard {
  const symbol = params.symbol.toUpperCase();
  const t = params.technicals;
  const r = params.risk;
  const price = clampFinite(params.quote?.regularMarketPrice) ?? clampFinite(t.latestClose);

  const closes = params.series.series
    .map((p) => p.close)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const sma5 = clampFinite(t.sma?.["5"] ?? sma(closes, 5));
  const sma10 = clampFinite(t.sma?.["10"] ?? sma(closes, 10));
  const sma20 = clampFinite(t.sma?.["20"] ?? sma(closes, 20));
  const lastBias5 = price !== undefined ? biasPct(price, sma5) : null;
  const lastBias10 = price !== undefined ? biasPct(price, sma10) : null;

  const trend = t.trend ?? "sideways";
  const rsi = clampFinite(t.rsi);
  const support = clampFinite(t.support);
  const resistance = clampFinite(t.resistance);
  const atr = clampFinite(t.atr);

  const checklist: DecisionDashboard["checklist"] = [];

  // Trend structure: MA alignment
  if (sma5 !== undefined && sma10 !== undefined && sma20 !== undefined) {
    const bull = sma5 > sma10 && sma10 > sma20;
    const bear = sma5 < sma10 && sma10 < sma20;
    checklist.push({
      key: "ma_alignment",
      status: bull ? "ok" : bear ? "bad" : "warn",
      detail: bull ? "MA5>MA10>MA20 多头排列" : bear ? "MA5<MA10<MA20 空头排列" : "均线缠绕/分化",
    });
  } else {
    checklist.push({
      key: "ma_alignment",
      status: "warn",
      detail: "均线数据不足",
    });
  }

  // Bias guardrail (no chasing)
  if (lastBias5 !== null) {
    checklist.push({
      key: "bias_ma5",
      status: lastBias5 > 0.05 ? "bad" : lastBias5 > 0.02 ? "warn" : "ok",
      detail: `乖离率(MA5)=${fmtPct(lastBias5)}`,
    });
  }

  // RSI (momentum / mean reversion risk)
  if (rsi !== undefined) {
    checklist.push({
      key: "rsi",
      status: rsi >= 70 ? "bad" : rsi >= 60 ? "warn" : rsi <= 30 ? "ok" : "ok",
      detail: `RSI=${round2(rsi)}`,
    });
  }

  // Risk (vol + drawdown)
  const dd = clampFinite(r.maxDrawdown);
  if (dd !== undefined) {
    checklist.push({
      key: "max_drawdown",
      status: dd >= 0.25 ? "bad" : dd >= 0.18 ? "warn" : "ok",
      detail: `maxDD=${(dd * 100).toFixed(2)}%`,
    });
  }

  const distToSupport = support !== undefined && price !== undefined ? pct(price, support) : null;
  const distToResistance =
    resistance !== undefined && price !== undefined ? pct(resistance, price) : null;

  // Decision rule: deterministic and conservative.
  let level: DecisionLevel = "watch";
  let confidence: DecisionDashboard["confidence"] = "medium";

  const biasOk = lastBias5 !== null ? lastBias5 <= 0.02 : false;
  const biasTooHot = lastBias5 !== null ? lastBias5 > 0.05 : false;
  const nearSupport = distToSupport !== null ? distToSupport <= 0.02 : false;
  const roomToResistance = distToResistance !== null ? distToResistance >= 0.03 : false;

  if (trend === "up" && !biasTooHot && (biasOk || nearSupport) && roomToResistance) {
    level = "buy";
    confidence = biasOk && rsi !== undefined && rsi >= 40 && rsi <= 60 ? "high" : "medium";
  } else if (trend === "down" && biasTooHot) {
    level = "sell";
    confidence = "medium";
  } else if (trend === "down") {
    level = "sell";
    confidence = "low";
  }

  const stopLoss =
    price !== undefined && atr !== undefined
      ? round2(price - atr * 1.5)
      : support !== undefined
        ? round2(support * 0.98)
        : undefined;
  const entry =
    price !== undefined && (biasOk || nearSupport) ? round2(price) : (clampFinite(sma5) ?? price);
  const target1 =
    resistance !== undefined
      ? round2(resistance)
      : price !== undefined && atr !== undefined
        ? round2(price + atr * 2)
        : undefined;
  const target2 = price !== undefined && atr !== undefined ? round2(price + atr * 3) : undefined;

  const oneSentenceParts: string[] = [];
  oneSentenceParts.push(
    `${symbol} ${level === "buy" ? "偏买入" : level === "sell" ? "偏减仓/规避" : "偏观望"}`,
  );
  if (price !== undefined) {
    oneSentenceParts.push(`现价${round2(price)}`);
  }
  if (support !== undefined && resistance !== undefined) {
    oneSentenceParts.push(`区间${round2(support)}-${round2(resistance)}`);
  }
  if (lastBias10 !== null) {
    oneSentenceParts.push(`乖离(MA10)=${fmtPct(lastBias10)}`);
  }

  return {
    symbol,
    asOfIso: pickAsOfIso(params.series, params.quote),
    price: round2(price),
    currency: params.quote?.currency,
    oneSentence: oneSentenceParts.join("，"),
    level,
    confidence,
    entry,
    stopLoss,
    target1,
    target2,
    support: round2(support),
    resistance: round2(resistance),
    checklist,
    technicals: {
      timeframe: t.timeframe,
      trend: t.trend,
      rsi: t.rsi,
      sma: t.sma,
      ema: t.ema,
      atr: t.atr,
      volatility: t.volatility,
      support: t.support,
      resistance: t.resistance,
    },
    risk: {
      timeframe: r.timeframe,
      volatility: r.volatility,
      maxDrawdown: r.maxDrawdown,
      valueAtRisk95: r.valueAtRisk95,
    },
    news: (params.news ?? []).slice(0, 5).map((n) => ({
      title: n.title,
      pubDate: n.pubDate,
      link: n.link,
    })),
  };
}

export function formatDecisionDashboardMarkdown(d: DecisionDashboard): string {
  const lines: string[] = [];
  lines.push(`## ${d.symbol} 决策仪表盘`);
  if (d.asOfIso) {
    lines.push(`- 截至: ${d.asOfIso}`);
  }
  if (d.price !== undefined) {
    lines.push(`- 现价: ${d.price}${d.currency ? ` ${d.currency}` : ""}`);
  }
  lines.push(`- 结论: ${d.oneSentence}`);
  lines.push(`- 建议: ${d.level.toUpperCase()} (confidence=${d.confidence})`);
  if (d.entry !== undefined || d.stopLoss !== undefined || d.target1 !== undefined) {
    lines.push(
      `- 点位: entry=${d.entry ?? "n/a"}, stop=${d.stopLoss ?? "n/a"}, t1=${d.target1 ?? "n/a"}, t2=${d.target2 ?? "n/a"}`,
    );
  }
  if (d.support !== undefined || d.resistance !== undefined) {
    lines.push(`- 关键位: support=${d.support ?? "n/a"}, resistance=${d.resistance ?? "n/a"}`);
  }
  lines.push("");
  lines.push("### Checklist");
  for (const c of d.checklist) {
    const badge = c.status === "ok" ? "✅" : c.status === "warn" ? "⚠️" : "❌";
    lines.push(`- ${badge} ${c.key}: ${c.detail}`);
  }
  if (d.news && d.news.length > 0) {
    lines.push("");
    lines.push("### News");
    for (const n of d.news.slice(0, 3)) {
      lines.push(`- ${n.pubDate ?? ""} ${n.title}`);
      lines.push(`  ${n.link}`);
    }
  }
  return lines.join("\n");
}
