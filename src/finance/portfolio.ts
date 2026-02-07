/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type { PortfolioOverview, PortfolioPosition, Quote } from "./types.js";

export function buildPortfolioOverview(
  positions: PortfolioPosition[],
  quotes: Quote[],
): PortfolioOverview {
  const bySymbol = new Map(quotes.map((q) => [q.symbol.toUpperCase(), q]));
  const overview: PortfolioOverview = {
    positions: [],
  };

  let totalValue = 0;
  let totalCost = 0;

  for (const position of positions) {
    const symbolKey = position.symbol.toUpperCase();
    const quote = bySymbol.get(symbolKey);
    const price = quote?.regularMarketPrice;
    const value = price !== undefined ? price * position.quantity : undefined;
    const cost =
      position.costBasis !== undefined ? position.costBasis * position.quantity : undefined;
    const pnl = value !== undefined && cost !== undefined ? value - cost : undefined;
    const pnlPercent =
      pnl !== undefined && cost !== undefined && cost !== 0 ? (pnl / cost) * 100 : undefined;

    if (value !== undefined) {
      totalValue += value;
    }
    if (cost !== undefined) {
      totalCost += cost;
    }

    overview.positions.push({
      symbol: position.symbol.toUpperCase(),
      quantity: position.quantity,
      price,
      value,
      costBasis: position.costBasis,
      pnl,
      pnlPercent,
    });
  }

  overview.totalValue = totalValue || undefined;
  overview.totalCost = totalCost || undefined;
  overview.totalUnrealizedPnl =
    overview.totalValue !== undefined && overview.totalCost !== undefined
      ? overview.totalValue - overview.totalCost
      : undefined;
  overview.totalUnrealizedPnlPercent =
    overview.totalUnrealizedPnl !== undefined && overview.totalCost && overview.totalCost !== 0
      ? (overview.totalUnrealizedPnl / overview.totalCost) * 100
      : undefined;

  return overview;
}
