/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type {
  FinanceBrief,
  Fundamentals,
  NewsItem,
  Quote,
  RiskMetrics,
  TechnicalSummary,
} from "./types.js";

function classifyHeadline(title: string): string {
  const t = title.toLowerCase();
  if (/(earnings|eps|revenue|guidance|q[1-4]\b|fy\b|quarter)/.test(t)) {
    return "earnings";
  }
  if (/(downgrade|upgrade|price target|initiates coverage|rating)/.test(t)) {
    return "analyst";
  }
  if (/(merger|acquisition|acquire|buyout|takeover|deal)/.test(t)) {
    return "m&a";
  }
  if (/(sec|doj|ftc|lawsuit|regulator|antitrust|probe|settlement)/.test(t)) {
    return "legal/regulatory";
  }
  if (/(fed|cpi|inflation|rates|jobs report|pmi|gdp|treasury)/.test(t)) {
    return "macro";
  }
  if (/(product|launch|ship|release|partnership|contract|customer)/.test(t)) {
    return "product/ops";
  }
  return "general";
}

export function buildFinanceBrief(params: {
  query: string;
  items: NewsItem[];
  symbol?: string;
  timeframe?: string;
  quote?: Quote;
  fundamentals?: Fundamentals;
  technicals?: TechnicalSummary;
  risk?: RiskMetrics;
}): FinanceBrief {
  const categories: Record<string, NewsItem[]> = {};
  for (const item of params.items) {
    const key = classifyHeadline(item.title ?? "");
    (categories[key] ??= []).push(item);
  }

  return {
    symbol: params.symbol?.toUpperCase(),
    query: params.query,
    timeframe: params.timeframe,
    quote: params.quote,
    fundamentals: params.fundamentals,
    technicals: params.technicals,
    risk: params.risk,
    items: params.items,
    categories,
  };
}
