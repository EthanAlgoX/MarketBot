/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type { Command } from "commander";
import fs from "node:fs/promises";

import { MarketDataClient } from "../../finance/client.js";
import { analyzeRisk, analyzeTechnicals } from "../../finance/analysis.js";
import { buildComparison } from "../../finance/compare.js";
import { buildFinanceBrief } from "../../finance/brief.js";
import { buildPortfolioOptimization } from "../../finance/optimize.js";
import { buildPortfolioOverview } from "../../finance/portfolio.js";
import { buildPortfolioRisk } from "../../finance/portfolio-risk.js";
import type { PortfolioPosition } from "../../finance/types.js";

function printResult(result: unknown, json: boolean) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export function registerFinanceCommand(program: Command) {
  const finance = program
    .command("finance")
    .description("Market data and analysis (browser-backed)");

  finance
    .option("--profile <name>", "Browser profile (default: marketbot)")
    .option("--json", "Output JSON", false);

  const getClient = (cmd: { profile?: string }) =>
    new MarketDataClient({ profile: cmd.profile?.trim() || "marketbot" });

  finance
    .command("quote <symbol>")
    .description("Fetch latest quote")
    .action(async (symbol: string, opts: { profile?: string; json?: boolean }) => {
      const client = getClient(opts);
      const quotes = await client.getQuotes([symbol]);
      printResult(quotes[0] ?? null, Boolean(opts.json));
    });

  finance
    .command("chart <symbol>")
    .description("Fetch historical price series")
    .option("--timeframe <tf>", "Timeframe (1h, 1d, 6mo, 1y, ytd, max)")
    .option("--limit <n>", "Limit points", (v) => Number.parseInt(v, 10))
    .action(
      async (
        symbol: string,
        opts: { profile?: string; json?: boolean; timeframe?: string; limit?: number },
      ) => {
        const client = getClient(opts);
        const series = await client.getMarketData({
          symbol,
          timeframe: opts.timeframe,
          limit:
            typeof opts.limit === "number" && Number.isFinite(opts.limit) ? opts.limit : undefined,
        });
        printResult(series, Boolean(opts.json));
      },
    );

  finance
    .command("technicals <symbol>")
    .description("Compute technical indicators")
    .option("--timeframe <tf>", "Timeframe (1h, 4h, 1d, 6mo, 1y)")
    .action(
      async (symbol: string, opts: { profile?: string; json?: boolean; timeframe?: string }) => {
        const client = getClient(opts);
        const series = await client.getMarketData({ symbol, timeframe: opts.timeframe });
        const technicals = analyzeTechnicals(series, opts.timeframe);
        printResult(technicals, Boolean(opts.json));
      },
    );

  finance
    .command("risk <symbol>")
    .description("Compute basic risk metrics")
    .option("--timeframe <tf>", "Timeframe (1h, 4h, 1d, 6mo, 1y)")
    .action(
      async (symbol: string, opts: { profile?: string; json?: boolean; timeframe?: string }) => {
        const client = getClient(opts);
        const series = await client.getMarketData({ symbol, timeframe: opts.timeframe });
        const risk = analyzeRisk(series, opts.timeframe);
        printResult(risk, Boolean(opts.json));
      },
    );

  finance
    .command("fundamentals <symbol>")
    .description("Fetch fundamentals")
    .action(async (symbol: string, opts: { profile?: string; json?: boolean }) => {
      const client = getClient(opts);
      const fundamentals = await client.getFundamentals(symbol);
      printResult(fundamentals, Boolean(opts.json));
    });

  finance
    .command("summary <symbol>")
    .description("Quote + technicals + risk + fundamentals")
    .option("--timeframe <tf>", "Timeframe (1h, 4h, 1d, 6mo, 1y)")
    .action(
      async (symbol: string, opts: { profile?: string; json?: boolean; timeframe?: string }) => {
        const client = getClient(opts);
        const series = await client.getMarketData({ symbol, timeframe: opts.timeframe });
        const [quote] = await client.getQuotes([symbol]);
        const technicals = analyzeTechnicals(series, opts.timeframe);
        const risk = analyzeRisk(series, opts.timeframe);
        const fundamentals = await client.getFundamentals(symbol);
        printResult({ quote, technicals, risk, fundamentals }, Boolean(opts.json));
      },
    );

  finance
    .command("news <query>")
    .description("Fetch recent headlines")
    .option("--limit <n>", "Limit items", (v) => Number.parseInt(v, 10))
    .option("--locale <code>", "Locale (default US)")
    .action(
      async (
        query: string,
        opts: { profile?: string; json?: boolean; limit?: number; locale?: string },
      ) => {
        const client = getClient(opts);
        const items = await client.getNews({
          query,
          limit:
            typeof opts.limit === "number" && Number.isFinite(opts.limit) ? opts.limit : undefined,
          locale: opts.locale,
        });
        printResult({ query, items }, Boolean(opts.json));
      },
    );

  finance
    .command("compare <symbols...>")
    .description("Compare symbols (returns, risk, correlations; optional beta vs benchmark)")
    .option("--timeframe <tf>", "Timeframe (1h, 1d, 6mo, 1y, ytd, max)")
    .option("--benchmark <sym>", "Benchmark symbol (e.g. SPY)")
    .action(
      async (
        symbols: string[],
        opts: { profile?: string; json?: boolean; timeframe?: string; benchmark?: string },
      ) => {
        const client = getClient(opts);
        const normalized = symbols.map((s) => s.trim()).filter(Boolean);
        if (normalized.length < 2) {
          throw new Error("compare requires at least 2 symbols");
        }
        const series = await Promise.all(
          normalized.map((symbol) => client.getMarketData({ symbol, timeframe: opts.timeframe })),
        );
        const benchmark = opts.benchmark
          ? await client.getMarketData({ symbol: opts.benchmark, timeframe: opts.timeframe })
          : null;
        const comparison = buildComparison({ series, timeframe: opts.timeframe, benchmark });
        printResult(comparison, Boolean(opts.json));
      },
    );

  finance
    .command("portfolio")
    .description("Portfolio overview + risk (JSON positions input)")
    .option("--positions-json <json>", "Positions JSON: [{symbol,quantity,costBasis?}]")
    .option("--positions-file <path>", "Positions JSON file")
    .option("--timeframe <tf>", "Timeframe for risk (6mo, 1y, max)")
    .option("--benchmark <sym>", "Benchmark symbol (e.g. SPY)")
    .action(
      async (opts: {
        profile?: string;
        json?: boolean;
        positionsJson?: string;
        positionsFile?: string;
        timeframe?: string;
        benchmark?: string;
      }) => {
        const client = getClient(opts);
        const raw =
          typeof opts.positionsJson === "string"
            ? opts.positionsJson
            : typeof opts.positionsFile === "string"
              ? await fs.readFile(opts.positionsFile, "utf8")
              : "";
        if (!raw.trim()) {
          throw new Error("portfolio requires --positions-json or --positions-file");
        }
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error("positions must be a non-empty array");
        }
        const positions = parsed as PortfolioPosition[];
        const symbols = positions.map((p) => p.symbol);

        const quotes = await client.getQuotes(symbols);
        const overview = buildPortfolioOverview(positions, quotes);

        // Value weights based on quote price * quantity (fallback to equal weights).
        const values: Array<{ symbol: string; value: number }> = [];
        const quoteBySym = new Map(quotes.map((q) => [q.symbol.toUpperCase(), q]));
        for (const p of positions) {
          const q = quoteBySym.get(p.symbol.toUpperCase());
          const price = q?.regularMarketPrice;
          const value = typeof price === "number" ? price * p.quantity : Number.NaN;
          if (Number.isFinite(value)) {
            values.push({ symbol: p.symbol.toUpperCase(), value });
          }
        }
        const total = values.reduce((acc, v) => acc + v.value, 0);
        const weights = new Map<string, number>();
        if (total > 0) {
          for (const v of values) {
            weights.set(v.symbol, v.value / total);
          }
        } else {
          const w = 1 / Math.max(positions.length, 1);
          for (const p of positions) {
            weights.set(p.symbol.toUpperCase(), w);
          }
        }

        const series = await Promise.all(
          symbols.map((symbol) => client.getMarketData({ symbol, timeframe: opts.timeframe })),
        );
        const seriesBySymbol = new Map(series.map((s) => [s.symbol.toUpperCase(), s]));
        const benchmark = opts.benchmark
          ? await client.getMarketData({ symbol: opts.benchmark, timeframe: opts.timeframe })
          : null;
        const risk = buildPortfolioRisk({
          seriesBySymbol,
          weights,
          timeframe: opts.timeframe,
          benchmark,
        });

        printResult({ overview, risk }, Boolean(opts.json));
      },
    );

  finance
    .command("brief <symbolOrQuery>")
    .description(
      "News-driven brief for a symbol/query (quote + technicals + risk + categorized headlines)",
    )
    .option("--timeframe <tf>", "Timeframe (6mo, 1y)")
    .option("--limit <n>", "Limit headlines", (v) => Number.parseInt(v, 10))
    .option("--locale <code>", "Locale (default US)")
    .option("--no-symbol", "Treat input as a query (do not fetch quote/fundamentals)")
    .action(
      async (
        symbolOrQuery: string,
        opts: {
          profile?: string;
          json?: boolean;
          timeframe?: string;
          limit?: number;
          locale?: string;
          symbol?: boolean;
        },
      ) => {
        const client = getClient(opts);
        const query = symbolOrQuery.trim();
        if (!query) {
          throw new Error("brief requires a symbol or query");
        }
        const items = await client.getNews({
          query,
          limit: typeof opts.limit === "number" && Number.isFinite(opts.limit) ? opts.limit : 10,
          locale: opts.locale,
        });

        const isSymbol = opts.symbol !== false;
        if (!isSymbol) {
          const brief = buildFinanceBrief({ query, items, timeframe: opts.timeframe });
          printResult(brief, Boolean(opts.json));
          return;
        }

        const symbol = query;
        const [quote] = await client.getQuotes([symbol]);
        const series = await client.getMarketData({ symbol, timeframe: opts.timeframe });
        const technicals = analyzeTechnicals(series, opts.timeframe);
        const risk = analyzeRisk(series, opts.timeframe);
        const fundamentals = await client.getFundamentals(symbol);
        const brief = buildFinanceBrief({
          query,
          items,
          symbol,
          timeframe: opts.timeframe,
          quote,
          fundamentals,
          technicals,
          risk,
        });
        printResult(brief, Boolean(opts.json));
      },
    );

  finance
    .command("optimize <symbols...>")
    .description("Portfolio min-variance weights (browser-backed historical covariance)")
    .option("--timeframe <tf>", "Timeframe (6mo, 1y, max)")
    .option("--benchmark <sym>", "Benchmark symbol (e.g. SPY)")
    .action(
      async (
        symbols: string[],
        opts: { profile?: string; json?: boolean; timeframe?: string; benchmark?: string },
      ) => {
        const client = getClient(opts);
        const normalized = symbols.map((s) => s.trim()).filter(Boolean);
        if (normalized.length < 2) {
          throw new Error("optimize requires at least 2 symbols");
        }

        const series = await Promise.all(
          normalized.map((symbol) => client.getMarketData({ symbol, timeframe: opts.timeframe })),
        );
        const seriesBySymbol = new Map(series.map((s) => [s.symbol.toUpperCase(), s]));
        const benchmark = opts.benchmark
          ? await client.getMarketData({ symbol: opts.benchmark, timeframe: opts.timeframe })
          : null;

        const result = buildPortfolioOptimization({
          seriesBySymbol,
          symbols: normalized,
          timeframe: opts.timeframe,
          benchmark,
        });
        printResult(result, Boolean(opts.json));
      },
    );
}
