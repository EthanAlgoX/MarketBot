/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

export type MarketDataPoint = {
  ts: number;
  iso: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

export type MarketSeries = {
  symbol: string;
  source: "yahoo" | "unknown";
  currency?: string;
  exchange?: string;
  timezone?: string;
  regularMarketPrice?: number;
  regularMarketTime?: number;
  series: MarketDataPoint[];
};

export type Quote = {
  symbol: string;
  shortName?: string;
  currency?: string;
  exchange?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number;
  marketState?: string;
};

export type Fundamentals = {
  symbol: string;
  currency?: string;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  dividendYield?: number;
  payoutRatio?: number;
  epsTrailingTwelveMonths?: number;
  epsForward?: number;
  revenueTTM?: number;
  grossMargins?: number;
  operatingMargins?: number;
  profitMargins?: number;
  debtToEquity?: number;
  returnOnEquity?: number;
  freeCashflow?: number;
  targetMeanPrice?: number;
  sharesOutstanding?: number;
  beta?: number;
  lastFiscalYearEnd?: number;
  earningsQuarterlyGrowth?: number;
};

export type TechnicalSummary = {
  symbol: string;
  timeframe?: string;
  latestClose?: number;
  changePercent?: number;
  trend?: "up" | "down" | "sideways";
  rsi?: number;
  macd?: { macd: number; signal: number; histogram: number };
  sma?: Record<string, number | undefined>;
  ema?: Record<string, number | undefined>;
  atr?: number;
  volatility?: number;
  support?: number;
  resistance?: number;
};

export type RiskMetrics = {
  symbol: string;
  timeframe?: string;
  volatility?: number;
  maxDrawdown?: number;
  valueAtRisk95?: number;
  beta?: number;
};

export type CorrelationMatrix = {
  symbols: string[];
  matrix: number[][];
};

export type ComparisonAssetSummary = {
  symbol: string;
  timeframe?: string;
  points?: number;
  latestClose?: number;
  periodReturnPercent?: number;
  volatility?: number;
  maxDrawdown?: number;
  valueAtRisk95?: number;
  beta?: number;
  sharpe?: number;
};

export type ComparisonOverview = {
  timeframe?: string;
  benchmark?: string;
  assets: ComparisonAssetSummary[];
  correlation?: CorrelationMatrix;
};

export type PortfolioPosition = {
  symbol: string;
  quantity: number;
  costBasis?: number;
};

export type PortfolioRiskContribution = {
  symbol: string;
  weight?: number;
  marginalRisk?: number;
  riskContribution?: number;
  riskContributionPercent?: number;
};

export type PortfolioRiskOverview = {
  timeframe?: string;
  benchmark?: string;
  positions: Array<{
    symbol: string;
    weight?: number;
  }>;
  volatility?: number;
  maxDrawdown?: number;
  valueAtRisk95?: number;
  beta?: number;
  correlation?: CorrelationMatrix;
  contributions?: PortfolioRiskContribution[];
};

export type PortfolioOptimizationOverview = {
  timeframe?: string;
  benchmark?: string;
  objective: "min_variance";
  weights: Array<{
    symbol: string;
    weight: number;
  }>;
  risk?: PortfolioRiskOverview;
};

export type PortfolioOverview = {
  currency?: string;
  totalValue?: number;
  totalCost?: number;
  totalUnrealizedPnl?: number;
  totalUnrealizedPnlPercent?: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    price?: number;
    value?: number;
    costBasis?: number;
    pnl?: number;
    pnlPercent?: number;
  }>;
};

export type NewsItem = {
  title: string;
  link: string;
  source?: string;
  pubDate?: string;
};

export type FinanceBrief = {
  symbol?: string;
  query: string;
  timeframe?: string;
  quote?: Quote;
  fundamentals?: Fundamentals;
  technicals?: TechnicalSummary;
  risk?: RiskMetrics;
  items: NewsItem[];
  categories?: Record<string, NewsItem[]>;
};
