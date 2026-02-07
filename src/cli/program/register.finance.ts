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
import {
  buildDecisionDashboard,
  formatDecisionDashboardMarkdown,
} from "../../finance/dashboard.js";
import {
  buildEquityResearchReport,
  formatEquityResearchReportMarkdown,
  type FinanceReportType,
} from "../../finance/report.js";
import type { PortfolioPosition } from "../../finance/types.js";
import { messageCommand } from "../../commands/message.js";
import { defaultRuntime } from "../../runtime.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { createDefaultDeps } from "../deps.js";
import { ensurePluginRegistryLoaded } from "../plugin-registry.js";

function printResult(result: unknown, json: boolean) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (typeof result === "string") {
    process.stdout.write(`${result}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function sendReportViaMessageCommand(params: {
  channel: string;
  target: string;
  message: string;
  json?: boolean;
  dryRun?: boolean;
}) {
  if (params.dryRun) {
    // Keep "daily_stock_analysis" style local testing simple: show payloads without requiring
    // channel configuration to exist in the local MarketBot config.
    process.stdout.write(
      `${JSON.stringify(
        { action: "send", channel: params.channel, target: params.target, message: params.message },
        null,
        2,
      )}\n`,
    );
    return;
  }
  ensurePluginRegistryLoaded();
  const deps = createDefaultDeps();
  await runCommandWithRuntime(
    defaultRuntime,
    async () => {
      await messageCommand(
        {
          action: "send",
          channel: params.channel,
          target: params.target,
          message: params.message,
          json: params.json === true,
          dryRun: params.dryRun === true,
        },
        deps,
        defaultRuntime,
      );
    },
    (err) => {
      throw err;
    },
  );
}

function parsePushSpecs(specs: string[] | undefined): Array<{ channel: string; target: string }> {
  const out: Array<{ channel: string; target: string }> = [];
  for (const raw of specs ?? []) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const idx = trimmed.indexOf(":");
    if (idx <= 0 || idx === trimmed.length - 1) {
      throw new Error(`invalid --push value: "${raw}" (expected "<channel>:<target>")`);
    }
    out.push({ channel: trimmed.slice(0, idx).trim(), target: trimmed.slice(idx + 1).trim() });
  }
  return out;
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
    .command("dashboard <symbols...>")
    .description("Decision dashboards (rule-based) for one or more symbols")
    .option("--timeframe <tf>", "Timeframe (1h, 4h, 1d, 6mo, 1y)")
    .option("--json", "Output JSON", false)
    .option("--news-limit <n>", "News headlines per symbol", (v) => Number.parseInt(v, 10), 3)
    .option("--locale <code>", "Locale for news (default US)")
    .action(
      async (
        symbols: string[],
        opts: {
          profile?: string;
          json?: boolean;
          timeframe?: string;
          newsLimit?: number;
          locale?: string;
        },
        cmd: Command,
      ) => {
        const client = getClient(opts);
        const normalized = symbols.map((s) => s.trim()).filter(Boolean);
        if (normalized.length === 0) {
          throw new Error("dashboard requires at least 1 symbol");
        }

        const dashboards = [];
        for (const symbol of normalized) {
          const series = await client.getMarketData({ symbol, timeframe: opts.timeframe });
          const displaySymbol = series.symbol || symbol;
          const [quote] = await client.getQuotes([displaySymbol]);
          const technicals = analyzeTechnicals(series, opts.timeframe);
          const risk = analyzeRisk(series, opts.timeframe);
          const newsLimit =
            typeof opts.newsLimit === "number" && Number.isFinite(opts.newsLimit)
              ? Math.max(0, Math.floor(opts.newsLimit))
              : 0;
          const news =
            newsLimit > 0
              ? await client.getNews({
                  query: displaySymbol,
                  limit: newsLimit,
                  locale: opts.locale,
                })
              : [];
          dashboards.push(
            buildDecisionDashboard({
              symbol: displaySymbol,
              series,
              quote: quote ?? undefined,
              technicals,
              risk,
              news,
            }),
          );
        }

        const json = Boolean(cmd.optsWithGlobals().json);
        if (json) {
          printResult({ timeframe: opts.timeframe ?? "6mo", dashboards }, true);
          return;
        }

        const rendered = dashboards
          .map((d) => formatDecisionDashboardMarkdown(d))
          .join("\n\n---\n\n");
        printResult(rendered, false);
      },
    );

  finance
    .command("report <symbol>")
    .description("Research-style markdown report (rule-based) for one symbol")
    .option("--timeframe <tf>", "Timeframe (1h, 4h, 1d, 6mo, 1y)")
    .option("--news-limit <n>", "News headlines to include", (v) => Number.parseInt(v, 10), 5)
    .option("--locale <code>", "Locale for news (default US)")
    .option("--report-type <type>", "Report type (simple|full)", "full")
    .option("--skip-fundamentals", "Skip fundamentals fetch", false)
    .action(
      async (
        symbol: string,
        opts: {
          profile?: string;
          json?: boolean;
          timeframe?: string;
          newsLimit?: number;
          locale?: string;
          reportType?: string;
          skipFundamentals?: boolean;
        },
        cmd: Command,
      ) => {
        const client = getClient(opts);
        const timeframe = opts.timeframe ?? "6mo";
        const newsLimit =
          typeof opts.newsLimit === "number" && Number.isFinite(opts.newsLimit)
            ? Math.max(0, Math.floor(opts.newsLimit))
            : 0;
        const reportType: FinanceReportType =
          opts.reportType?.toLowerCase() === "simple" ? "simple" : "full";

        const series = await client.getMarketData({ symbol, timeframe });
        const displaySymbol = series.symbol || symbol;
        const [quote] = await client.getQuotes([displaySymbol]);
        const technicals = analyzeTechnicals(series, timeframe);
        const risk = analyzeRisk(series, timeframe);
        const fundamentals = opts.skipFundamentals
          ? { symbol: displaySymbol.toUpperCase() }
          : await client.getFundamentals(displaySymbol);
        const news =
          newsLimit > 0
            ? await client.getNews({ query: displaySymbol, limit: newsLimit, locale: opts.locale })
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

        const json = Boolean(cmd.optsWithGlobals().json);
        if (json) {
          printResult({ reportType, report }, true);
          return;
        }
        printResult(formatEquityResearchReportMarkdown(report, { reportType }), false);
      },
    );

  finance
    .command("daily")
    .description(
      "Daily watchlist run (dashboards -> optional save -> optional multi-channel push). Reads STOCK_LIST when --stocks is omitted.",
    )
    .option("--stocks <list>", "Comma-separated symbols (overrides STOCK_LIST env)")
    .option("--timeframe <tf>", "Timeframe (1h, 4h, 1d, 6mo, 1y)")
    .option("--news-limit <n>", "News headlines per symbol", (v) => Number.parseInt(v, 10), 3)
    .option("--locale <code>", "Locale for news (default US)")
    .option("--report-type <type>", "Report type (simple|full)", "full")
    .option("--out <path>", "Write the markdown report to a file")
    .option(
      "--push <channel:target>",
      "Push report to a channel target (repeatable). Example: --push telegram:@mychat",
      (value, prev: string[] = []) => prev.concat([value]),
      [],
    )
    .option(
      "--single-push",
      "Push each symbol report as it's produced (default: push one combined report)",
      false,
    )
    .option("--push-dry-run", "Do not send; print the message payloads that would be sent", false)
    .action(
      async (opts: {
        profile?: string;
        stocks?: string;
        timeframe?: string;
        newsLimit?: number;
        locale?: string;
        reportType?: string;
        out?: string;
        push?: string[];
        singlePush?: boolean;
        pushDryRun?: boolean;
      }) => {
        const list =
          typeof opts.stocks === "string" && opts.stocks.trim()
            ? opts.stocks
            : (process.env.STOCK_LIST ?? "");
        const symbols = list
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (symbols.length === 0) {
          throw new Error('finance daily requires --stocks "<sym1,sym2>" or env STOCK_LIST');
        }

        const pushes = parsePushSpecs(opts.push);
        const client = getClient(opts);
        const timeframe = opts.timeframe ?? "6mo";
        const reportType: FinanceReportType =
          opts.reportType?.toLowerCase() === "simple" ? "simple" : "full";
        const newsLimit =
          typeof opts.newsLimit === "number" && Number.isFinite(opts.newsLimit)
            ? Math.max(0, Math.floor(opts.newsLimit))
            : 0;

        const dashboards = [];
        const todayIso = new Date().toISOString().slice(0, 10);

        const mkHeader = (counts: { buy: number; watch: number; sell: number }) =>
          [
            `# ${todayIso} 决策仪表盘`,
            `${symbols.length} symbols | BUY:${counts.buy} WATCH:${counts.watch} SELL:${counts.sell}`,
            `timeframe=${timeframe}`,
          ].join("\n");

        const bumpCounts = (
          counts: { buy: number; watch: number; sell: number },
          level: "buy" | "watch" | "sell",
        ) => {
          if (level === "buy") {
            counts.buy += 1;
          }
          if (level === "watch") {
            counts.watch += 1;
          }
          if (level === "sell") {
            counts.sell += 1;
          }
        };

        const counts = { buy: 0, watch: 0, sell: 0 };
        for (const symbol of symbols) {
          const series = await client.getMarketData({ symbol, timeframe });
          const displaySymbol = series.symbol || symbol;
          const [quote] = await client.getQuotes([displaySymbol]);
          const technicals = analyzeTechnicals(series, timeframe);
          const risk = analyzeRisk(series, timeframe);
          const resolvedNewsLimit = reportType === "simple" ? Math.min(2, newsLimit) : newsLimit;
          const news =
            resolvedNewsLimit > 0
              ? await client.getNews({
                  query: displaySymbol,
                  limit: resolvedNewsLimit,
                  locale: opts.locale,
                })
              : [];
          const dash = buildDecisionDashboard({
            symbol: displaySymbol,
            series,
            quote: quote ?? undefined,
            technicals,
            risk,
            news,
          });
          dashboards.push(dash);
          bumpCounts(counts, dash.level);

          if (opts.singlePush && pushes.length > 0) {
            let msg: string;
            if (reportType === "simple") {
              const parts: string[] = [
                mkHeader(counts),
                "",
                `## ${dash.symbol}`,
                `- ${dash.oneSentence}`,
                `- 建议: ${dash.level.toUpperCase()} (confidence=${dash.confidence})`,
                `- 点位: entry=${dash.entry ?? "n/a"}, stop=${dash.stopLoss ?? "n/a"}, t1=${dash.target1 ?? "n/a"}`,
              ];
              if (news[0]?.title) {
                parts.push(`- News: ${news[0].title}`);
              }
              msg = parts.join("\n");
            } else {
              msg = [mkHeader(counts), "", formatDecisionDashboardMarkdown(dash)].join("\n");
            }
            for (const p of pushes) {
              await sendReportViaMessageCommand({
                channel: p.channel,
                target: p.target,
                message: msg,
                dryRun: Boolean(opts.pushDryRun),
              });
            }
          }
        }

        const body =
          reportType === "simple"
            ? dashboards
                .map((d) => {
                  const badge = d.level === "buy" ? "🟢" : d.level === "sell" ? "🔴" : "🟡";
                  return [
                    `## ${badge} ${d.symbol} | ${d.level.toUpperCase()}`,
                    `- ${d.oneSentence}`,
                    `- 点位: entry=${d.entry ?? "n/a"}, stop=${d.stopLoss ?? "n/a"}, t1=${d.target1 ?? "n/a"}`,
                  ].join("\n");
                })
                .join("\n\n---\n\n")
            : dashboards.map((d) => formatDecisionDashboardMarkdown(d)).join("\n\n---\n\n");
        const report = [mkHeader(counts), "", body].join("\n");

        if (typeof opts.out === "string" && opts.out.trim()) {
          await fs.writeFile(opts.out, report, "utf8");
        }

        if (!opts.singlePush && pushes.length > 0) {
          for (const p of pushes) {
            await sendReportViaMessageCommand({
              channel: p.channel,
              target: p.target,
              message: report,
              dryRun: Boolean(opts.pushDryRun),
            });
          }
        }

        // Always print the report to stdout for local testing/logs.
        process.stdout.write(`${report}\n`);
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
