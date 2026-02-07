/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { loadWatchlist, saveWatchlist } from "../../finance/watchlist-store.js";
import { loadDailyStockLast, saveDailyStockLast } from "../../finance/daily-stock-store.js";
import { runDailyStock, runStockReport } from "../../finance/daily-stock.js";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") {
      continue;
    }
    const trimmed = v.trim();
    if (trimmed) {
      out.push(trimmed);
    }
  }
  return out;
}

export const financeHandlers: GatewayRequestHandlers = {
  "finance.watchlist.get": async ({ respond }) => {
    const symbols = await loadWatchlist("default");
    respond(true, { name: "default", watchlist: symbols }, undefined);
  },

  "finance.watchlist.set": async ({ params, respond }) => {
    const raw = params as any;
    const list = asStringArray(raw?.watchlist);
    if (!list) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "invalid watchlist payload"),
      );
      return;
    }
    const saved = await saveWatchlist({ name: "default", symbols: list });
    respond(
      true,
      { name: saved.name, watchlist: saved.symbols, updatedAtIso: saved.updatedAtIso },
      undefined,
    );
  },

  "finance.daily.last": async ({ respond }) => {
    const last = await loadDailyStockLast();
    respond(true, { last }, undefined);
  },

  "finance.daily.run": async ({ params, respond }) => {
    const raw = params as any;
    const symbols = asStringArray(raw?.symbols);
    const watchlist = symbols && symbols.length > 0 ? symbols : await loadWatchlist("default");
    if (watchlist.length === 0) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "watchlist is empty"));
      return;
    }
    const timeframe = asString(raw?.timeframe) || undefined;
    const reportTypeRaw = asString(raw?.reportType).trim().toLowerCase();
    const reportType = reportTypeRaw === "full" ? "full" : "simple";
    const newsLimit = asNumber(raw?.newsLimit);
    const locale = asString(raw?.locale) || undefined;
    const includeFundamentals = asBoolean(raw?.includeFundamentals);
    const profile = asString(raw?.profile) || "marketbot";

    const result = await runDailyStock({
      symbols: watchlist,
      timeframe,
      reportType,
      newsLimit,
      locale,
      profile,
      includeFundamentals: includeFundamentals ?? false,
    });
    await saveDailyStockLast(result).catch(() => undefined);
    respond(true, { result }, undefined);
  },

  "finance.report.run": async ({ params, respond }) => {
    const raw = params as any;
    const symbol = asString(raw?.symbol);
    if (!symbol.trim()) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "symbol required"));
      return;
    }
    const timeframe = asString(raw?.timeframe) || undefined;
    const reportTypeRaw = asString(raw?.reportType).trim().toLowerCase();
    const reportType = reportTypeRaw === "simple" ? "simple" : "full";
    const newsLimit = asNumber(raw?.newsLimit);
    const locale = asString(raw?.locale) || undefined;
    const includeFundamentals = asBoolean(raw?.includeFundamentals);
    const profile = asString(raw?.profile) || "marketbot";

    const result = await runStockReport({
      symbol,
      timeframe,
      reportType,
      newsLimit,
      locale,
      profile,
      includeFundamentals: includeFundamentals ?? true,
    });
    respond(true, { result }, undefined);
  },
};
