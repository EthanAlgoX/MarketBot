/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { MarketDataClient } from "./client.js";
import { analyzeRisk, analyzeTechnicals } from "./analysis.js";
import { buildDecisionDashboard, formatDecisionDashboardMarkdown } from "./dashboard.js";
import { buildEquityResearchReport, formatEquityResearchReportMarkdown } from "./report.js";
import type { DecisionDashboard } from "./dashboard.js";
import type { EquityResearchReport, FinanceReportType } from "./report.js";

export type DailyStockRunParams = {
  symbols: string[];
  timeframe?: string;
  reportType?: FinanceReportType;
  newsLimit?: number;
  locale?: string;
  profile?: string;
  includeFundamentals?: boolean;
};

export type StockReportParams = {
  symbol: string;
  timeframe?: string;
  reportType?: FinanceReportType;
  newsLimit?: number;
  locale?: string;
  profile?: string;
  includeFundamentals?: boolean;
};

export type StockReportResult = {
  symbol: string;
  timeframe: string;
  reportType: FinanceReportType;
  markdown: string;
  dashboard: DecisionDashboard;
  report: EquityResearchReport;
};

export type DailyStockItemResult =
  | {
      ok: true;
      symbolInput: string;
      symbol: string;
      dashboard: DecisionDashboard;
      report: EquityResearchReport;
      markdown: string;
    }
  | {
      ok: false;
      symbolInput: string;
      symbol: string;
      error: string;
    };

export type DailyStockRunResult = {
  dateIso: string;
  timeframe: string;
  reportType: FinanceReportType;
  symbols: string[];
  counts: { buy: number; watch: number; sell: number; failed: number };
  items: DailyStockItemResult[];
  reportMarkdown: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeList(input: string[]): string[] {
  return input.map((s) => s.trim()).filter(Boolean);
}

function bumpCounts(counts: DailyStockRunResult["counts"], level: "buy" | "watch" | "sell") {
  if (level === "buy") {
    counts.buy += 1;
  }
  if (level === "watch") {
    counts.watch += 1;
  }
  if (level === "sell") {
    counts.sell += 1;
  }
}

function mkHeader(params: {
  dateIso: string;
  timeframe: string;
  symbols: string[];
  counts: DailyStockRunResult["counts"];
}): string {
  const { dateIso, timeframe, symbols, counts } = params;
  return [
    `# ${dateIso} 决策仪表盘`,
    `${symbols.length} symbols | BUY:${counts.buy} WATCH:${counts.watch} SELL:${counts.sell} FAIL:${counts.failed}`,
    `timeframe=${timeframe}`,
  ].join("\n");
}

export async function runDailyStock(params: DailyStockRunParams): Promise<DailyStockRunResult> {
  const symbols = normalizeList(params.symbols);
  if (symbols.length === 0) {
    throw new Error("daily stock requires at least 1 symbol");
  }
  const timeframe = params.timeframe ?? "6mo";
  const reportType: FinanceReportType = params.reportType ?? "simple";
  const includeFundamentals = params.includeFundamentals ?? false;
  const baseNewsLimit =
    typeof params.newsLimit === "number" && Number.isFinite(params.newsLimit)
      ? Math.max(0, Math.floor(params.newsLimit))
      : 2;
  const newsLimit = reportType === "simple" ? Math.min(2, baseNewsLimit) : baseNewsLimit;

  const client = new MarketDataClient({ profile: params.profile?.trim() || "marketbot" });

  const counts = { buy: 0, watch: 0, sell: 0, failed: 0 };
  const items: DailyStockItemResult[] = [];

  for (const symbolInput of symbols) {
    try {
      const series = await client.getMarketData({ symbol: symbolInput, timeframe });
      const displaySymbol = series.symbol || symbolInput;
      const [quote] = await client.getQuotes([displaySymbol]);
      const technicals = analyzeTechnicals(series, timeframe);
      const risk = analyzeRisk(series, timeframe);
      const fundamentals = includeFundamentals
        ? await client.getFundamentals(displaySymbol)
        : { symbol: displaySymbol.toUpperCase() };
      const news =
        newsLimit > 0
          ? await client.getNews({ query: displaySymbol, limit: newsLimit, locale: params.locale })
          : [];
      const dashboard = buildDecisionDashboard({
        symbol: displaySymbol,
        series,
        quote: quote ?? undefined,
        technicals,
        risk,
        news,
      });
      bumpCounts(counts, dashboard.level);
      const report = buildEquityResearchReport({
        symbol: displaySymbol,
        timeframe,
        series,
        quote: quote ?? undefined,
        fundamentals,
        technicals,
        risk,
        dashboard,
        news,
      });
      const markdown =
        reportType === "full"
          ? formatEquityResearchReportMarkdown(report, { reportType: "full" })
          : formatDecisionDashboardMarkdown(dashboard);
      items.push({
        ok: true,
        symbolInput,
        symbol: displaySymbol,
        dashboard,
        report,
        markdown,
      });
    } catch (err) {
      counts.failed += 1;
      const symbol = symbolInput.trim().toUpperCase();
      items.push({
        ok: false,
        symbolInput,
        symbol,
        error: String(err),
      });
    }
  }

  const dateIso = todayIso();
  const header = mkHeader({ dateIso, timeframe, symbols, counts });
  const body = items
    .map((item) => {
      if (!item.ok) {
        return [`## 🔴 ${item.symbol} | FAILED`, `- error: ${item.error}`].join("\n");
      }
      return item.markdown;
    })
    .join("\n\n---\n\n");
  const reportMarkdown = [header, "", body].join("\n");

  return {
    dateIso,
    timeframe,
    reportType,
    symbols,
    counts,
    items,
    reportMarkdown,
  };
}

export async function runStockReport(params: StockReportParams): Promise<StockReportResult> {
  const symbolInput = params.symbol.trim();
  if (!symbolInput) {
    throw new Error("stock report requires a symbol");
  }
  const timeframe = params.timeframe ?? "6mo";
  const reportType: FinanceReportType = params.reportType ?? "full";
  const includeFundamentals = params.includeFundamentals ?? true;
  const baseNewsLimit =
    typeof params.newsLimit === "number" && Number.isFinite(params.newsLimit)
      ? Math.max(0, Math.floor(params.newsLimit))
      : 5;
  const newsLimit = reportType === "simple" ? Math.min(2, baseNewsLimit) : baseNewsLimit;

  const client = new MarketDataClient({ profile: params.profile?.trim() || "marketbot" });
  const series = await client.getMarketData({ symbol: symbolInput, timeframe });
  const displaySymbol = series.symbol || symbolInput;
  const [quote] = await client.getQuotes([displaySymbol]);
  const technicals = analyzeTechnicals(series, timeframe);
  const risk = analyzeRisk(series, timeframe);
  const fundamentals = includeFundamentals
    ? await client.getFundamentals(displaySymbol)
    : { symbol: displaySymbol.toUpperCase() };
  const news =
    newsLimit > 0
      ? await client.getNews({ query: displaySymbol, limit: newsLimit, locale: params.locale })
      : [];
  const dashboard = buildDecisionDashboard({
    symbol: displaySymbol,
    series,
    quote: quote ?? undefined,
    technicals,
    risk,
    news,
  });
  const report = buildEquityResearchReport({
    symbol: displaySymbol,
    timeframe,
    series,
    quote: quote ?? undefined,
    fundamentals,
    technicals,
    risk,
    dashboard,
    news,
  });
  const markdown =
    reportType === "full"
      ? formatEquityResearchReportMarkdown(report, { reportType: "full" })
      : formatEquityResearchReportMarkdown(report, { reportType: "simple" });

  return {
    symbol: displaySymbol,
    timeframe,
    reportType,
    markdown,
    dashboard,
    report,
  };
}
