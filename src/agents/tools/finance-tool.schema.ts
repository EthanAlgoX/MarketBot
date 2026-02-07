/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { Type } from "@sinclair/typebox";
import { optionalStringEnum, stringEnum } from "../schema/typebox.js";

const FINANCE_ACTIONS = [
  "market_data",
  "quote",
  "fundamentals",
  "technicals",
  "risk",
  "summary",
  "portfolio",
  "portfolio_risk",
  "optimize",
  "news",
  "compare",
  "brief",
] as const;

export const FinanceToolSchema = Type.Object({
  action: stringEnum(FINANCE_ACTIONS),
  symbol: Type.Optional(Type.String()),
  symbols: Type.Optional(Type.Array(Type.String())),
  timeframe: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
  profile: Type.Optional(Type.String()),
  query: Type.Optional(Type.String()),
  locale: Type.Optional(Type.String()),
  benchmark: Type.Optional(Type.String()),
  positions: Type.Optional(
    Type.Array(
      Type.Object({
        symbol: Type.String(),
        quantity: Type.Number(),
        costBasis: Type.Optional(Type.Number()),
      }),
    ),
  ),
  weights: Type.Optional(Type.Record(Type.String(), Type.Number())),
  data: Type.Optional(Type.Object({}, { additionalProperties: true })),
  metrics: Type.Optional(Type.Array(Type.String())),
  actionHint: optionalStringEnum(["fast", "full"] as const),
});
