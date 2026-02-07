/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type {
  Fundamentals,
  MarketSeries,
  NewsItem,
  Quote,
  RiskMetrics,
  TechnicalSummary,
} from "./types.js";
import type { DecisionDashboard } from "./dashboard.js";

export type FinanceReportType = "simple" | "full";

export type EquityResearchPerformance = {
  periodReturn?: number;
  last5Return?: number;
  last20Return?: number;
  high?: number;
  low?: number;
  startClose?: number;
  endClose?: number;
};

export type EquityResearchReport = {
  symbol: string;
  timeframe?: string;
  asOfIso?: string;
  quote?: Quote;
  fundamentals?: Fundamentals;
  technicals: TechnicalSummary;
  risk: RiskMetrics;
  dashboard: DecisionDashboard;
  performance: EquityResearchPerformance;
  news: NewsItem[];
};

function clampFinite(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function pct(a: number | undefined, b: number | undefined): number | undefined {
  if (
    typeof a !== "number" ||
    typeof b !== "number" ||
    !Number.isFinite(a) ||
    !Number.isFinite(b)
  ) {
    return undefined;
  }
  if (b === 0) {
    return undefined;
  }
  return (a - b) / b;
}

function pickAsOfIso(series: MarketSeries, quote?: Quote): string | undefined {
  if (quote?.regularMarketTime) {
    return new Date(quote.regularMarketTime).toISOString();
  }
  return series.series.at(-1)?.iso;
}

function computePerformance(series: MarketSeries): EquityResearchPerformance {
  const closes = series.series
    .map((p) => p.close)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const startClose = clampFinite(closes.at(0));
  const endClose = clampFinite(closes.at(-1));
  const periodReturn = pct(endClose, startClose);

  const idx5 = closes.length >= 6 ? closes.length - 6 : -1;
  const idx20 = closes.length >= 21 ? closes.length - 21 : -1;
  const close5 = idx5 >= 0 ? clampFinite(closes[idx5]) : undefined;
  const close20 = idx20 >= 0 ? clampFinite(closes[idx20]) : undefined;

  const last5Return = pct(endClose, close5);
  const last20Return = pct(endClose, close20);

  const high = closes.length ? clampFinite(Math.max(...closes)) : undefined;
  const low = closes.length ? clampFinite(Math.min(...closes)) : undefined;

  return { periodReturn, last5Return, last20Return, high, low, startClose, endClose };
}

function fmtPct(value: number | undefined): string {
  if (value === undefined) {
    return "n/a";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function round2(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(value * 100) / 100;
}

function levelBadge(level: "buy" | "watch" | "sell"): string {
  if (level === "buy") {
    return "🟢";
  }
  if (level === "sell") {
    return "🔴";
  }
  return "🟡";
}

export function buildEquityResearchReport(params: {
  symbol: string;
  timeframe?: string;
  series: MarketSeries;
  quote?: Quote;
  fundamentals?: Fundamentals;
  technicals: TechnicalSummary;
  risk: RiskMetrics;
  dashboard: DecisionDashboard;
  news?: NewsItem[];
}): EquityResearchReport {
  return {
    symbol: params.symbol.toUpperCase(),
    timeframe: params.timeframe,
    asOfIso: pickAsOfIso(params.series, params.quote),
    quote: params.quote,
    fundamentals: params.fundamentals,
    technicals: params.technicals,
    risk: params.risk,
    dashboard: params.dashboard,
    performance: computePerformance(params.series),
    news: params.news ?? [],
  };
}

export function formatEquityResearchReportMarkdown(
  r: EquityResearchReport,
  opts: { reportType?: FinanceReportType } = {},
): string {
  const reportType: FinanceReportType = opts.reportType ?? "full";
  const d = r.dashboard;

  const lines: string[] = [];
  lines.push(`# ${levelBadge(d.level)} ${r.symbol} 研报式摘要`);
  lines.push(`- 截至: ${r.asOfIso ?? "n/a"}`);
  if (d.price !== undefined) {
    lines.push(`- 现价: ${d.price}${d.currency ? ` ${d.currency}` : ""}`);
  }
  lines.push(`- 评级: ${d.level.toUpperCase()} (confidence=${d.confidence})`);
  lines.push(`- 核心结论: ${d.oneSentence}`);

  lines.push("");
  lines.push("## 价格表现");
  lines.push(
    `- 区间涨跌: ${fmtPct(r.performance.periodReturn)} | 近5期: ${fmtPct(r.performance.last5Return)} | 近20期: ${fmtPct(r.performance.last20Return)}`,
  );
  if (r.performance.high !== undefined || r.performance.low !== undefined) {
    lines.push(
      `- 区间高低: high=${round2(r.performance.high) ?? "n/a"} low=${round2(r.performance.low) ?? "n/a"}`,
    );
  }

  lines.push("");
  lines.push("## 交易计划");
  lines.push(
    `- 点位: entry=${d.entry ?? "n/a"}, stop=${d.stopLoss ?? "n/a"}, t1=${d.target1 ?? "n/a"}, t2=${d.target2 ?? "n/a"}`,
  );
  lines.push(`- 关键位: support=${d.support ?? "n/a"}, resistance=${d.resistance ?? "n/a"}`);

  lines.push("");
  lines.push("## 技术面");
  lines.push(
    `- 趋势: ${r.technicals.trend ?? "n/a"} | RSI: ${round2(r.technicals.rsi) ?? "n/a"} | ATR: ${round2(r.technicals.atr) ?? "n/a"}`,
  );
  if (r.technicals.sma?.["20"] !== undefined || r.technicals.sma?.["50"] !== undefined) {
    lines.push(
      `- 均线: SMA20=${round2(r.technicals.sma?.["20"])} SMA50=${round2(r.technicals.sma?.["50"])} SMA200=${round2(r.technicals.sma?.["200"])}`,
    );
  }

  lines.push("");
  lines.push("## 风险");
  lines.push(
    `- 波动率: ${r.risk.volatility !== undefined ? fmtPct(r.risk.volatility) : "n/a"} | 最大回撤: ${r.risk.maxDrawdown !== undefined ? fmtPct(r.risk.maxDrawdown) : "n/a"} | VaR(95%): ${r.risk.valueAtRisk95 !== undefined ? fmtPct(r.risk.valueAtRisk95) : "n/a"}`,
  );

  if (reportType === "full") {
    lines.push("");
    lines.push("## 检查清单");
    for (const c of d.checklist) {
      const badge = c.status === "ok" ? "✅" : c.status === "warn" ? "⚠️" : "❌";
      lines.push(`- ${badge} ${c.key}: ${c.detail}`);
    }
  }

  if (r.news.length > 0) {
    lines.push("");
    lines.push("## 舆情与事件");
    for (const n of r.news.slice(0, reportType === "full" ? 5 : 2)) {
      const date = n.pubDate ? `${n.pubDate} ` : "";
      lines.push(`- ${date}${n.title}`);
      if (reportType === "full" && n.link) {
        lines.push(`  ${n.link}`);
      }
    }
  }

  lines.push("");
  lines.push(
    "_Disclaimer: this is an automated, rule-based summary for research; not investment advice._",
  );
  return lines.join("\n");
}
