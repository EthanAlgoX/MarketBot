import YahooFinance from "yahoo-finance2";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { getTickers, Market } from "./tickers.js";

type OutputFormat = "text" | "json";

interface AnnualFinancialPoint {
  date: string;
  totalRevenue?: number;
  netIncome?: number;
  dilutedEPS?: number;
  basicEPS?: number;
  dilutedAverageShares?: number;
}

interface AnnualBalanceSheetPoint {
  date: string;
  stockholdersEquity?: number;
  longTermDebt?: number;
  longTermDebtAndCapitalLeaseObligation?: number;
  totalDebt?: number;
  cashAndCashEquivalents?: number;
  cashCashEquivalentsAndShortTermInvestments?: number;
}

interface AnnualCashFlowPoint {
  date: string;
  operatingCashFlow?: number;
  capitalExpenditure?: number;
  freeCashFlow?: number;
}

interface QuarterlySharesPoint {
  date: string;
  ordinarySharesNumber?: number;
  shareIssued?: number;
}

interface YieldYearPoint {
  year: number;
  yield: number;
}

interface TickerSnapshot {
  schemaVersion: number;
  ticker: string;
  annualFinancials: AnnualFinancialPoint[];
  annualBalanceSheet: AnnualBalanceSheetPoint[];
  annualCashFlow: AnnualCashFlowPoint[];
  quarterlyShares: QuarterlySharesPoint[];
  operatingMargins?: number;
  dividendYield?: number;
  sharesOutstanding?: number;
  currentPrice?: number;
  marketCap?: number;
  yearlyDividendYields: YieldYearPoint[];
}

interface GrowthStats {
  positiveCount: number;
  intervals: number;
  cagrPercent?: number;
}

interface DcfResult {
  intrinsicValuePerShare?: number;
  upsidePercent?: number;
}

interface CompounderRow {
  ticker: string;
  revenueGrowth: GrowthStats;
  netIncomeGrowth: GrowthStats;
  epsGrowth: GrowthStats;
  roicPercent?: number;
  latestFcf?: number;
  fcfGrowthPercent?: number;
  sharesChange3yPercent?: number;
  operatingMarginPercent?: number;
  currentYieldPercent?: number;
  avgYield5yPercent?: number;
  yieldVs5yAvgPercent?: number;
  dcfIntrinsicValuePerShare?: number;
  dcfUpsidePercent?: number;
  carlsonQualityScore: number;
}

interface CliOptions {
  market: Market;
  tickers?: string[];
  maxTickers?: number;
  topN: number;
  concurrency: number;
  format: OutputFormat;
  dbPath: string;
  ttlDays: number;
  minRoic: number;
  minOperatingMargin: number;
  minBuybackPercent: number;
  showRejected: boolean;
}

interface FilterEvaluation {
  pass: boolean;
  revenuePass: boolean;
  netIncomePass: boolean;
  roicPass: boolean;
  buybackPass: boolean;
  marginPass: boolean;
  revenueRequired: number;
  netIncomeRequired: number;
}

interface RawFundamentalsPoint {
  date?: Date | number | string;
  TYPE?: string;
  totalRevenue?: number;
  operatingRevenue?: number;
  netIncome?: number;
  netIncomeCommonStockholders?: number;
  dilutedEPS?: number;
  basicEPS?: number;
  dilutedAverageShares?: number;
  stockholdersEquity?: number;
  longTermDebt?: number;
  longTermDebtAndCapitalLeaseObligation?: number;
  totalDebt?: number;
  cashAndCashEquivalents?: number;
  cashCashEquivalentsAndShortTermInvestments?: number;
  operatingCashFlow?: number;
  capitalExpenditure?: number;
  freeCashFlow?: number;
  ordinarySharesNumber?: number;
  shareIssued?: number;
}

interface QuoteSummarySubset {
  financialData?: {
    operatingMargins?: number;
    currentPrice?: number;
  };
  defaultKeyStatistics?: {
    sharesOutstanding?: number;
  };
  summaryDetail?: {
    dividendYield?: number;
    marketCap?: number;
  };
  price?: {
    regularMarketPrice?: number;
  };
}

interface HistoricalPoint {
  date?: Date;
  close?: number;
  dividends?: number;
}

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

async function getSql(): Promise<ReturnType<typeof initSqlJs>> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs();
  }
  return sqlPromise;
}

class CompounderDataCache {
  private db: SqlJsDatabase | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private ttlMs: number;

  constructor(private dbPath: string, ttlDays: number) {
    this.ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    const SQL = await getSql();

    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS compounder_data (
        ticker TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        fetched_at TEXT NOT NULL
      )
    `);

    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    }
  }

  async get(ticker: string): Promise<TickerSnapshot | null> {
    await this.ensureInitialized();
    if (!this.db) return null;

    const stmt = this.db.prepare(
      "SELECT payload_json, fetched_at FROM compounder_data WHERE ticker = ?"
    );
    stmt.bind([ticker]);

    try {
      if (!stmt.step()) return null;
      const row = stmt.getAsObject() as { payload_json: string; fetched_at: string };
      const age = Date.now() - new Date(row.fetched_at).getTime();
      if (age > this.ttlMs) return null;
      return JSON.parse(row.payload_json) as TickerSnapshot;
    } finally {
      stmt.free();
    }
  }

  async set(ticker: string, snapshot: TickerSnapshot): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) return;

    this.db.run(
      `INSERT OR REPLACE INTO compounder_data (ticker, payload_json, fetched_at)
       VALUES (?, ?, ?)`,
      [ticker, JSON.stringify(snapshot), new Date().toISOString()]
    );
    this.save();
  }

  close(): void {
    if (!this.db) return;
    this.save();
    this.db.close();
    this.db = null;
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }
}

class StockDataFetcher {
  private yahooFinance = new YahooFinance({
    suppressNotices: ["yahooSurvey", "ripHistorical"],
    validation: { logErrors: false, logOptionsErrors: false },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      dir: () => {},
    },
  });
  private cache: CompounderDataCache;

  constructor(
    dbPath: string,
    ttlDays: number,
    private requestDelayMs: number = 250,
    private maxRetries: number = 4
  ) {
    this.cache = new CompounderDataCache(dbPath, ttlDays);
  }

  async close(): Promise<void> {
    this.cache.close();
  }

  async fetchTickerSnapshot(ticker: string): Promise<TickerSnapshot | null> {
    const cached = await this.cache.get(ticker);
    if (cached && cached.schemaVersion === 1) return cached;

    const snapshot = await this.fetchWithRetry(ticker);
    if (snapshot) {
      await this.cache.set(ticker, snapshot);
    }
    return snapshot;
  }

  private async fetchWithRetry(ticker: string): Promise<TickerSnapshot | null> {
    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        const data = await this.fetchFromApi(ticker);
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isLast = attempt >= this.maxRetries;
        if (isLast) {
          console.error(`  ${ticker}: failed after retries (${message})`);
          return null;
        }
        const backoff = Math.round(
          this.requestDelayMs * Math.pow(2, attempt) + Math.random() * 250
        );
        await sleep(backoff);
      }
      attempt++;
    }
    return null;
  }

  private async fetchFromApi(ticker: string): Promise<TickerSnapshot> {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 8);

    const quoteSummaryPromise = this.yahooFinance.quoteSummary(
      ticker,
      {
        modules: ["financialData", "defaultKeyStatistics", "summaryDetail", "price"],
      },
      { validateResult: false }
    ) as Promise<QuoteSummarySubset>;

    const annualFinancialsPromise = this.yahooFinance.fundamentalsTimeSeries(
      ticker,
      { period1, type: "annual", module: "financials" },
      { validateResult: false }
    ) as Promise<RawFundamentalsPoint[]>;

    const annualBalanceSheetPromise = this.yahooFinance.fundamentalsTimeSeries(
      ticker,
      { period1, type: "annual", module: "balance-sheet" },
      { validateResult: false }
    ) as Promise<RawFundamentalsPoint[]>;

    const annualCashFlowPromise = this.yahooFinance.fundamentalsTimeSeries(
      ticker,
      { period1, type: "annual", module: "cash-flow" },
      { validateResult: false }
    ) as Promise<RawFundamentalsPoint[]>;

    const quarterlyBalanceSheetPromise = this.yahooFinance.fundamentalsTimeSeries(
      ticker,
      { period1, type: "quarterly", module: "balance-sheet" },
      { validateResult: false }
    ) as Promise<RawFundamentalsPoint[]>;

    const historyPromise = this.yahooFinance.historical(ticker, {
      period1,
      period2: new Date(),
      interval: "1d",
    }) as Promise<HistoricalPoint[]>;

    await sleep(this.requestDelayMs);
    const [
      quoteSummary,
      annualFinancialsRaw,
      annualBalanceSheetRaw,
      annualCashFlowRaw,
      quarterlyBalanceSheetRaw,
      history,
    ] = await Promise.all([
      quoteSummaryPromise,
      annualFinancialsPromise,
      annualBalanceSheetPromise,
      annualCashFlowPromise,
      quarterlyBalanceSheetPromise,
      historyPromise,
    ]);

    const annualFinancials = toAnnualFinancialPoints(annualFinancialsRaw);
    const annualBalanceSheet = toAnnualBalanceSheetPoints(annualBalanceSheetRaw);
    const annualCashFlow = toAnnualCashFlowPoints(annualCashFlowRaw);
    const quarterlyShares = toQuarterlySharesPoints(quarterlyBalanceSheetRaw);
    const yearlyDividendYields = computeYearlyDividendYields(history);

    const operatingMargins = toNumber(quoteSummary.financialData?.operatingMargins);
    const dividendYield = toNumber(quoteSummary.summaryDetail?.dividendYield);
    const sharesOutstanding = toNumber(
      quoteSummary.defaultKeyStatistics?.sharesOutstanding
    );
    const currentPrice =
      toNumber(quoteSummary.price?.regularMarketPrice) ??
      toNumber(quoteSummary.financialData?.currentPrice);
    const marketCap = toNumber(quoteSummary.summaryDetail?.marketCap);

    return {
      schemaVersion: 1,
      ticker,
      annualFinancials,
      annualBalanceSheet,
      annualCashFlow,
      quarterlyShares,
      operatingMargins,
      dividendYield,
      sharesOutstanding,
      currentPrice,
      marketCap,
      yearlyDividendYields,
    };
  }
}

function normalizeDate(value: Date | number | string | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function sortByDateAsc<T extends { date: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

function dedupeByDate<T extends { date: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(row.date, row);
  }
  return sortByDateAsc(Array.from(map.values()));
}

function toAnnualFinancialPoints(raw: RawFundamentalsPoint[]): AnnualFinancialPoint[] {
  const points: AnnualFinancialPoint[] = [];
  for (const row of raw) {
    const date = normalizeDate(row.date);
    if (!date) continue;

    const totalRevenue = toNumber(row.totalRevenue) ?? toNumber(row.operatingRevenue);
    const netIncome =
      toNumber(row.netIncomeCommonStockholders) ?? toNumber(row.netIncome);
    const dilutedEPS = toNumber(row.dilutedEPS);
    const basicEPS = toNumber(row.basicEPS);
    const dilutedAverageShares = toNumber(row.dilutedAverageShares);

    if (
      totalRevenue === undefined &&
      netIncome === undefined &&
      dilutedEPS === undefined &&
      basicEPS === undefined &&
      dilutedAverageShares === undefined
    ) {
      continue;
    }

    points.push({
      date,
      totalRevenue,
      netIncome,
      dilutedEPS,
      basicEPS,
      dilutedAverageShares,
    });
  }
  return dedupeByDate(points);
}

function toAnnualBalanceSheetPoints(raw: RawFundamentalsPoint[]): AnnualBalanceSheetPoint[] {
  const points: AnnualBalanceSheetPoint[] = [];
  for (const row of raw) {
    const date = normalizeDate(row.date);
    if (!date) continue;

    const stockholdersEquity = toNumber(row.stockholdersEquity);
    const longTermDebt = toNumber(row.longTermDebt);
    const longTermDebtAndCapitalLeaseObligation = toNumber(
      row.longTermDebtAndCapitalLeaseObligation
    );
    const totalDebt = toNumber(row.totalDebt);
    const cashAndCashEquivalents = toNumber(row.cashAndCashEquivalents);
    const cashCashEquivalentsAndShortTermInvestments = toNumber(
      row.cashCashEquivalentsAndShortTermInvestments
    );

    if (
      stockholdersEquity === undefined &&
      longTermDebt === undefined &&
      longTermDebtAndCapitalLeaseObligation === undefined &&
      totalDebt === undefined &&
      cashAndCashEquivalents === undefined &&
      cashCashEquivalentsAndShortTermInvestments === undefined
    ) {
      continue;
    }

    points.push({
      date,
      stockholdersEquity,
      longTermDebt,
      longTermDebtAndCapitalLeaseObligation,
      totalDebt,
      cashAndCashEquivalents,
      cashCashEquivalentsAndShortTermInvestments,
    });
  }
  return dedupeByDate(points);
}

function toAnnualCashFlowPoints(raw: RawFundamentalsPoint[]): AnnualCashFlowPoint[] {
  const points: AnnualCashFlowPoint[] = [];
  for (const row of raw) {
    const date = normalizeDate(row.date);
    if (!date) continue;

    const operatingCashFlow = toNumber(row.operatingCashFlow);
    const capitalExpenditure = toNumber(row.capitalExpenditure);
    const freeCashFlow = toNumber(row.freeCashFlow);
    if (
      operatingCashFlow === undefined &&
      capitalExpenditure === undefined &&
      freeCashFlow === undefined
    ) {
      continue;
    }

    points.push({
      date,
      operatingCashFlow,
      capitalExpenditure,
      freeCashFlow,
    });
  }
  return dedupeByDate(points);
}

function toQuarterlySharesPoints(raw: RawFundamentalsPoint[]): QuarterlySharesPoint[] {
  const points: QuarterlySharesPoint[] = [];
  for (const row of raw) {
    const date = normalizeDate(row.date);
    if (!date) continue;
    const ordinarySharesNumber = toNumber(row.ordinarySharesNumber);
    const shareIssued = toNumber(row.shareIssued);
    if (ordinarySharesNumber === undefined && shareIssued === undefined) {
      continue;
    }
    points.push({
      date,
      ordinarySharesNumber,
      shareIssued,
    });
  }
  return dedupeByDate(points);
}

function computeYearlyDividendYields(history: HistoricalPoint[]): YieldYearPoint[] {
  const byYear = new Map<number, { closeSum: number; closeCount: number; divSum: number }>();
  for (const item of history) {
    if (!(item.date instanceof Date) || Number.isNaN(item.date.getTime())) continue;
    const year = item.date.getUTCFullYear();
    const close = toNumber(item.close);
    const dividends = toNumber(item.dividends) ?? 0;
    if (!byYear.has(year)) {
      byYear.set(year, { closeSum: 0, closeCount: 0, divSum: 0 });
    }
    const row = byYear.get(year);
    if (!row) continue;
    if (close && close > 0) {
      row.closeSum += close;
      row.closeCount += 1;
    }
    row.divSum += dividends;
  }

  const result: YieldYearPoint[] = [];
  for (const [year, row] of byYear.entries()) {
    if (row.closeCount === 0) continue;
    const avgPrice = row.closeSum / row.closeCount;
    if (avgPrice <= 0) continue;
    result.push({ year, yield: row.divSum / avgPrice });
  }
  result.sort((a, b) => a.year - b.year);
  return result.slice(-5);
}

function growthStats(values: number[]): GrowthStats {
  if (values.length < 2) {
    return { positiveCount: 0, intervals: 0 };
  }

  const intervals = values.length - 1;
  let positiveCount = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) {
      positiveCount += 1;
    }
  }

  let cagrPercent: number | undefined;
  const first = values[0];
  const last = values[values.length - 1];
  if (first > 0 && last > 0 && intervals > 0) {
    cagrPercent = (Math.pow(last / first, 1 / intervals) - 1) * 100;
  }

  return { positiveCount, intervals, cagrPercent };
}

function computeRoicPercent(snapshot: TickerSnapshot): number | undefined {
  const latestBalance = snapshot.annualBalanceSheet[snapshot.annualBalanceSheet.length - 1];
  const latestNetIncome =
    snapshot.annualFinancials[snapshot.annualFinancials.length - 1]?.netIncome;
  if (!latestBalance || latestNetIncome === undefined) return undefined;

  const equity = latestBalance.stockholdersEquity;
  const debt =
    latestBalance.longTermDebtAndCapitalLeaseObligation ??
    latestBalance.longTermDebt ??
    latestBalance.totalDebt ??
    0;
  const cash =
    latestBalance.cashCashEquivalentsAndShortTermInvestments ??
    latestBalance.cashAndCashEquivalents ??
    0;

  if (equity === undefined) return undefined;

  const investedCapital = equity + debt - cash;
  if (!Number.isFinite(investedCapital) || investedCapital <= 0) return undefined;

  return (latestNetIncome / investedCapital) * 100;
}

function computeAnnualFcfSeries(snapshot: TickerSnapshot): number[] {
  const values: number[] = [];
  for (const row of snapshot.annualCashFlow) {
    const fcfFromField = row.freeCashFlow;
    if (fcfFromField !== undefined && Number.isFinite(fcfFromField)) {
      values.push(fcfFromField);
      continue;
    }
    if (row.operatingCashFlow === undefined || row.capitalExpenditure === undefined) {
      continue;
    }
    const capex = row.capitalExpenditure;
    const computed = capex < 0 ? row.operatingCashFlow + capex : row.operatingCashFlow - capex;
    values.push(computed);
  }
  return values;
}

function computeSharesChange3y(snapshot: TickerSnapshot): number | undefined {
  const quarterlySeries = snapshot.quarterlyShares
    .map((q) => q.ordinarySharesNumber ?? q.shareIssued)
    .filter((v): v is number => v !== undefined && Number.isFinite(v) && v > 0);

  if (quarterlySeries.length >= 13) {
    const latest = quarterlySeries[quarterlySeries.length - 1];
    const threeYearsAgo = quarterlySeries[quarterlySeries.length - 13];
    if (threeYearsAgo > 0) {
      return ((latest / threeYearsAgo) - 1) * 100;
    }
  }

  const annualShareSeries = snapshot.annualFinancials
    .map((f) => f.dilutedAverageShares)
    .filter((v): v is number => v !== undefined && Number.isFinite(v) && v > 0);

  if (annualShareSeries.length >= 4) {
    const latest = annualShareSeries[annualShareSeries.length - 1];
    const threeYearsAgo = annualShareSeries[annualShareSeries.length - 4];
    if (threeYearsAgo > 0) {
      return ((latest / threeYearsAgo) - 1) * 100;
    }
  }

  return undefined;
}

function computeOperatingMarginPercent(snapshot: TickerSnapshot): number | undefined {
  const value = snapshot.operatingMargins;
  if (value === undefined) return undefined;
  return value <= 1 ? value * 100 : value;
}

function computeYieldMetrics(snapshot: TickerSnapshot): {
  currentYieldPercent?: number;
  avgYield5yPercent?: number;
  yieldVs5yAvgPercent?: number;
} {
  const currentYieldPercent =
    snapshot.dividendYield !== undefined
      ? (snapshot.dividendYield <= 1 ? snapshot.dividendYield * 100 : snapshot.dividendYield)
      : undefined;

  const yields = snapshot.yearlyDividendYields.map((x) => x.yield).filter((x) => x >= 0);
  const avgYield = yields.length > 0 ? yields.reduce((a, b) => a + b, 0) / yields.length : undefined;
  const avgYield5yPercent = avgYield !== undefined ? avgYield * 100 : undefined;

  const yieldVs5yAvgPercent =
    currentYieldPercent !== undefined && avgYield5yPercent !== undefined
      ? currentYieldPercent - avgYield5yPercent
      : undefined;

  return {
    currentYieldPercent,
    avgYield5yPercent,
    yieldVs5yAvgPercent,
  };
}

function computeDcf(snapshot: TickerSnapshot, fcfSeries: number[]): DcfResult {
  if (fcfSeries.length < 2) return {};

  const sharesOutstanding =
    snapshot.sharesOutstanding ??
    snapshot.quarterlyShares[snapshot.quarterlyShares.length - 1]?.ordinarySharesNumber ??
    snapshot.quarterlyShares[snapshot.quarterlyShares.length - 1]?.shareIssued;
  const currentPrice = snapshot.currentPrice;
  const latestFcf = fcfSeries[fcfSeries.length - 1];

  if (
    latestFcf === undefined ||
    latestFcf <= 0 ||
    sharesOutstanding === undefined ||
    sharesOutstanding <= 0
  ) {
    return {};
  }

  const trailing = fcfSeries.slice(-3).filter((v) => v > 0);
  let growth = 0.04;
  if (trailing.length >= 2) {
    const first = trailing[0];
    const last = trailing[trailing.length - 1];
    const periods = trailing.length - 1;
    growth = Math.pow(last / first, 1 / periods) - 1;
  }
  growth = clamp(growth, -0.05, 0.20);

  const discountRate = 0.10;
  const terminalGrowth = 0.025;

  let pv = 0;
  let projectedFcf = latestFcf;
  for (let year = 1; year <= 10; year++) {
    projectedFcf *= 1 + growth;
    pv += projectedFcf / Math.pow(1 + discountRate, year);
  }

  const terminalValue =
    (projectedFcf * (1 + terminalGrowth)) / Math.max(0.0001, discountRate - terminalGrowth);
  const discountedTerminal = terminalValue / Math.pow(1 + discountRate, 10);
  const intrinsicEquityValue = pv + discountedTerminal;
  const intrinsicValuePerShare = intrinsicEquityValue / sharesOutstanding;

  if (!Number.isFinite(intrinsicValuePerShare) || intrinsicValuePerShare <= 0) {
    return {};
  }

  const upsidePercent =
    currentPrice && currentPrice > 0
      ? ((intrinsicValuePerShare / currentPrice) - 1) * 100
      : undefined;

  return { intrinsicValuePerShare, upsidePercent };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildRow(snapshot: TickerSnapshot): CompounderRow {
  const revenueSeries = snapshot.annualFinancials
    .map((f) => f.totalRevenue)
    .filter((v): v is number => v !== undefined && Number.isFinite(v) && v > 0)
    .slice(-6);
  const netIncomeSeries = snapshot.annualFinancials
    .map((f) => f.netIncome)
    .filter((v): v is number => v !== undefined && Number.isFinite(v))
    .slice(-6);
  const epsSeries = snapshot.annualFinancials
    .map((f) => f.dilutedEPS ?? f.basicEPS)
    .filter((v): v is number => v !== undefined && Number.isFinite(v))
    .slice(-6);

  const revenueGrowth = growthStats(revenueSeries);
  const netIncomeGrowth = growthStats(netIncomeSeries);
  const epsGrowth = growthStats(epsSeries);

  const roicPercent = computeRoicPercent(snapshot);
  const fcfSeries = computeAnnualFcfSeries(snapshot);
  const latestFcf = fcfSeries[fcfSeries.length - 1];
  const fcfGrowth = growthStats(fcfSeries.slice(-4));
  const sharesChange3yPercent = computeSharesChange3y(snapshot);
  const operatingMarginPercent = computeOperatingMarginPercent(snapshot);
  const yieldMetrics = computeYieldMetrics(snapshot);
  const dcf = computeDcf(snapshot, fcfSeries);

  const carlsonQualityScore = computeCarlsonScore({
    revenueGrowth,
    netIncomeGrowth,
    epsGrowth,
    roicPercent,
    latestFcf,
    fcfGrowthPercent: fcfGrowth.cagrPercent,
    sharesChange3yPercent,
    operatingMarginPercent,
  });

  return {
    ticker: snapshot.ticker,
    revenueGrowth,
    netIncomeGrowth,
    epsGrowth,
    roicPercent,
    latestFcf,
    fcfGrowthPercent: fcfGrowth.cagrPercent,
    sharesChange3yPercent,
    operatingMarginPercent,
    currentYieldPercent: yieldMetrics.currentYieldPercent,
    avgYield5yPercent: yieldMetrics.avgYield5yPercent,
    yieldVs5yAvgPercent: yieldMetrics.yieldVs5yAvgPercent,
    dcfIntrinsicValuePerShare: dcf.intrinsicValuePerShare,
    dcfUpsidePercent: dcf.upsidePercent,
    carlsonQualityScore,
  };
}

function computeCarlsonScore(input: {
  revenueGrowth: GrowthStats;
  netIncomeGrowth: GrowthStats;
  epsGrowth: GrowthStats;
  roicPercent?: number;
  latestFcf?: number;
  fcfGrowthPercent?: number;
  sharesChange3yPercent?: number;
  operatingMarginPercent?: number;
}): number {
  let score = 0;

  score += normalizedGrowthScore(input.revenueGrowth, 20);
  score += normalizedGrowthScore(input.netIncomeGrowth, 20);
  score += normalizedGrowthScore(input.epsGrowth, 10);

  if (input.roicPercent !== undefined) {
    score += clamp((input.roicPercent - 5) / 20, 0, 1) * 20;
  }

  if (input.latestFcf !== undefined && input.latestFcf > 0) {
    score += 5;
  }
  if (input.fcfGrowthPercent !== undefined) {
    score += clamp((input.fcfGrowthPercent + 5) / 20, 0, 1) * 5;
  }

  if (input.sharesChange3yPercent !== undefined) {
    score += clamp((-input.sharesChange3yPercent) / 8, 0, 1) * 10;
  }

  if (input.operatingMarginPercent !== undefined) {
    score += clamp((input.operatingMarginPercent - 10) / 20, 0, 1) * 10;
  }

  return clamp(Math.round(score), 1, 100);
}

function normalizedGrowthScore(stats: GrowthStats, weight: number): number {
  if (stats.intervals <= 0) return 0;
  return (stats.positiveCount / stats.intervals) * weight;
}

function evaluateCarlsonFilters(
  row: CompounderRow,
  options: CliOptions
): FilterEvaluation {
  const requiredFromIntervals = (intervals: number): number =>
    Math.max(1, Math.round(intervals * 0.8));
  const revenueRequired = requiredFromIntervals(row.revenueGrowth.intervals);
  const netIncomeRequired = requiredFromIntervals(row.netIncomeGrowth.intervals);

  const revenuePass =
    row.revenueGrowth.intervals >= 3 && row.revenueGrowth.positiveCount >= revenueRequired;
  const netIncomePass =
    row.netIncomeGrowth.intervals >= 3 && row.netIncomeGrowth.positiveCount >= netIncomeRequired;
  const roicPass = row.roicPercent !== undefined && row.roicPercent > options.minRoic;
  const buybackPass =
    row.sharesChange3yPercent !== undefined &&
    row.sharesChange3yPercent <= -Math.abs(options.minBuybackPercent);
  const marginPass =
    row.operatingMarginPercent !== undefined &&
    row.operatingMarginPercent > options.minOperatingMargin;

  return {
    pass: revenuePass && netIncomePass && roicPass && buybackPass && marginPass,
    revenuePass,
    netIncomePass,
    roicPass,
    buybackPass,
    marginPass,
    revenueRequired,
    netIncomeRequired,
  };
}

async function runCompoundingMachine(options: CliOptions): Promise<string> {
  const verbose = options.format !== "json";
  const tickers =
    options.tickers && options.tickers.length > 0
      ? options.tickers
      : await getTickers(options.market);

  const selectedTickers =
    options.maxTickers !== undefined ? tickers.slice(0, options.maxTickers) : tickers;

  if (verbose) {
    console.log(`📈 Compounding Machine (${options.market.toUpperCase()})`);
    console.log(`  Universe size: ${selectedTickers.length}`);
  }

  const fetcher = new StockDataFetcher(options.dbPath, options.ttlDays);
  const rows: CompounderRow[] = [];
  const diagnostics: Array<{ row: CompounderRow; evaluation: FilterEvaluation }> = [];

  try {
    await mapWithConcurrency(selectedTickers, options.concurrency, async (ticker, index) => {
      const snapshot = await fetcher.fetchTickerSnapshot(ticker);
      if (!snapshot) {
        if (verbose && (index + 1) % 25 === 0) {
          console.log(`  Progress: ${index + 1}/${selectedTickers.length}`);
        }
        return;
      }

      const row = buildRow(snapshot);
      const evaluation = evaluateCarlsonFilters(row, options);
      if (evaluation.pass) {
        rows.push(row);
      }
      if (options.showRejected || options.tickers) {
        diagnostics.push({ row, evaluation });
      }

      if (verbose && ((index + 1) % 25 === 0 || index + 1 === selectedTickers.length)) {
        console.log(`  Progress: ${index + 1}/${selectedTickers.length}`);
      }
    });
  } finally {
    await fetcher.close();
  }

  rows.sort((a, b) => b.carlsonQualityScore - a.carlsonQualityScore);
  const topRows = rows.slice(0, options.topN);

  if (options.format === "json") {
    return JSON.stringify(
      {
        market: options.market,
        scanned: selectedTickers.length,
        qualified: rows.length,
        filters: {
          growthRule: "Revenue and Net Income: positive YoY trend (>=80% of available yearly intervals; equivalent to 4/5)",
          minRoicPercent: options.minRoic,
          minBuybackPercent: options.minBuybackPercent,
          minOperatingMarginPercent: options.minOperatingMargin,
        },
        diagnostics: diagnostics
          .filter((d) => options.showRejected || Boolean(options.tickers) || d.evaluation.pass)
          .map((d) => ({
            ticker: d.row.ticker,
            pass: d.evaluation.pass,
            checks: {
              revenue: {
                pass: d.evaluation.revenuePass,
                got: `${d.row.revenueGrowth.positiveCount}/${d.row.revenueGrowth.intervals}`,
                required: `${d.evaluation.revenueRequired}/${d.row.revenueGrowth.intervals}`,
              },
              netIncome: {
                pass: d.evaluation.netIncomePass,
                got: `${d.row.netIncomeGrowth.positiveCount}/${d.row.netIncomeGrowth.intervals}`,
                required: `${d.evaluation.netIncomeRequired}/${d.row.netIncomeGrowth.intervals}`,
              },
              roic: { pass: d.evaluation.roicPass, gotPercent: d.row.roicPercent ?? null },
              buyback3y: {
                pass: d.evaluation.buybackPass,
                gotPercent: d.row.sharesChange3yPercent ?? null,
              },
              operatingMargin: {
                pass: d.evaluation.marginPass,
                gotPercent: d.row.operatingMarginPercent ?? null,
              },
            },
          })),
        results: topRows,
      },
      null,
      2
    );
  }

  return formatTable(
    selectedTickers.length,
    rows.length,
    topRows,
    options,
    diagnostics
  );
}

function formatTable(
  scanned: number,
  qualified: number,
  rows: CompounderRow[],
  options: CliOptions,
  diagnostics: Array<{ row: CompounderRow; evaluation: FilterEvaluation }>
): string {
  const lines: string[] = [];
  lines.push("📈 Compounding Machine Screener");
  lines.push(`Scanned: ${scanned}`);
  lines.push(`Qualified: ${qualified}`);
  lines.push(
    `Filters: YoY growth >=80% of available yearly intervals (4/5 target), ROIC > ${options.minRoic}%, ` +
      `Buyback <= -${Math.abs(options.minBuybackPercent)}% (3y), Operating Margin > ${options.minOperatingMargin}%`
  );

  if (rows.length === 0) {
    lines.push("No tickers passed the Carlson filters.");
    if (options.showRejected || options.tickers) {
      lines.push("");
      lines.push("Diagnostics:");
      for (const item of diagnostics) {
        const { row, evaluation } = item;
        const failed: string[] = [];
        if (!evaluation.revenuePass) {
          failed.push(
            `Revenue YoY ${row.revenueGrowth.positiveCount}/${row.revenueGrowth.intervals}` +
              ` (need ${evaluation.revenueRequired}/${row.revenueGrowth.intervals})`
          );
        }
        if (!evaluation.netIncomePass) {
          failed.push(
            `Net Income YoY ${row.netIncomeGrowth.positiveCount}/${row.netIncomeGrowth.intervals}` +
              ` (need ${evaluation.netIncomeRequired}/${row.netIncomeGrowth.intervals})`
          );
        }
        if (!evaluation.roicPass) {
          failed.push(`ROIC ${formatPct(row.roicPercent, 1)} (need > ${options.minRoic}%)`);
        }
        if (!evaluation.buybackPass) {
          failed.push(
            `Buyback 3Y ${formatPct(row.sharesChange3yPercent, 1)} (need <= -${Math.abs(options.minBuybackPercent)}%)`
          );
        }
        if (!evaluation.marginPass) {
          failed.push(
            `Operating Margin ${formatPct(row.operatingMarginPercent, 1)} (need > ${options.minOperatingMargin}%)`
          );
        }
        lines.push(`- ${row.ticker}: ${failed.join("; ") || "No failures"}`);
      }
    }
    return lines.join("\n");
  }

  lines.push("");
  lines.push(
    [
      pad("Ticker", 8),
      pad("Score", 6),
      pad("RevYoY", 7),
      pad("NIYoY", 7),
      pad("ROIC", 8),
      pad("Buyback3Y", 10),
      pad("OpMargin", 9),
      pad("YieldΔ", 8),
      pad("DCF↑", 8),
    ].join(" | ")
  );
  lines.push("-".repeat(94));

  for (const row of rows) {
    lines.push(
      [
        pad(row.ticker, 8),
        pad(String(row.carlsonQualityScore), 6),
        pad(`${row.revenueGrowth.positiveCount}/${row.revenueGrowth.intervals}`, 7),
        pad(`${row.netIncomeGrowth.positiveCount}/${row.netIncomeGrowth.intervals}`, 7),
        pad(formatPct(row.roicPercent, 1), 8),
        pad(formatPct(row.sharesChange3yPercent, 1), 10),
        pad(formatPct(row.operatingMarginPercent, 1), 9),
        pad(formatPct(row.yieldVs5yAvgPercent, 1), 8),
        pad(formatPct(row.dcfUpsidePercent, 1), 8),
      ].join(" | ")
    );
  }

  lines.push("");
  lines.push("Notes:");
  lines.push("- YieldΔ = Current yield minus 5-year average yield.");
  lines.push("- DCF↑ = DCF implied upside/downside versus current price.");
  lines.push("- Data source: Yahoo fundamentals + quote data via yahoo-finance2.");

  return lines.join("\n");
}

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width);
}

function formatPct(value: number | undefined, decimals: number): string {
  if (value === undefined || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(decimals)}%`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function installYahooNoiseFilter(): void {
  const originalLog = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      (first.startsWith("Could not determine entry type:") ||
        first.startsWith("missing periodType"))
    ) {
      return;
    }
    originalLog(...args);
  };
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const safeConcurrency = Math.max(1, concurrency);

  const runners = Array.from({ length: safeConcurrency }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      await worker(items[current], current);
    }
  });

  await Promise.all(runners);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    market: "us",
    topN: 25,
    concurrency: 4,
    format: "text",
    dbPath: "sec_cache.db",
    ttlDays: 7,
    minRoic: 15,
    minOperatingMargin: 20,
    minBuybackPercent: 2,
    showRejected: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (!arg.startsWith("--")) continue;

    if (arg === "--market" && value) {
      if (value === "us" || value === "bk") {
        options.market = value;
      } else {
        throw new Error("Invalid --market. Use 'us' or 'bk'.");
      }
      i++;
    } else if (arg === "--tickers" && value) {
      options.tickers = value
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      i++;
    } else if (arg === "--top-n" && value) {
      options.topN = Number(value);
      i++;
    } else if (arg === "--concurrency" && value) {
      options.concurrency = Number(value);
      i++;
    } else if (arg === "--format" && value) {
      if (value === "text" || value === "json") {
        options.format = value;
      } else {
        throw new Error("Invalid --format. Use 'text' or 'json'.");
      }
      i++;
    } else if (arg === "--db-path" && value) {
      options.dbPath = value;
      i++;
    } else if (arg === "--ttl-days" && value) {
      options.ttlDays = Number(value);
      i++;
    } else if (arg === "--max-tickers" && value) {
      options.maxTickers = Number(value);
      i++;
    } else if (arg === "--min-roic" && value) {
      options.minRoic = Number(value);
      i++;
    } else if (arg === "--min-op-margin" && value) {
      options.minOperatingMargin = Number(value);
      i++;
    } else if (arg === "--min-buyback" && value) {
      options.minBuybackPercent = Number(value);
      i++;
    } else if (arg === "--show-rejected") {
      options.showRejected = true;
    }
  }

  return options;
}

async function main(): Promise<void> {
  try {
    installYahooNoiseFilter();
    const options = parseArgs(process.argv.slice(2));
    const output = await runCompoundingMachine(options);
    console.log(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
