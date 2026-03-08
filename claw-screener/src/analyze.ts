import YahooFinance from "yahoo-finance2";
import { SECClient, extractFinancialFacts, Financials } from "./secApi.js";
import { FormulaEngine, FormulaResult } from "./formulas.js";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type OutputFormat = "text" | "json" | "telegram";

function isThaiTicker(ticker: string): boolean {
  return ticker.toUpperCase().endsWith(".BK");
}

interface YahooFinanceData {
  price?: {
    regularMarketPrice?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
  };
  summaryDetail?: {
    marketCap?: number;
    trailingPE?: number;
    forwardPE?: number;
    dividendRate?: number;
    dividendYield?: number;
    fiftyTwoWeekLow?: number;
    fiftyTwoWeekHigh?: number;
  };
  defaultKeyStatistics?: {
    bookValue?: number;
    priceToBook?: number;
    beta?: number;
    floatShares?: number;
    sharesOutstanding?: number;
    trailingEps?: number;
    forwardEps?: number;
  };
  financialData?: {
    currentPrice?: number;
    totalCash?: number;
    totalDebt?: number;
    quickRatio?: number;
    currentRatio?: number;
    totalRevenue?: number;
    returnOnAssets?: number;
    returnOnEquity?: number;
    freeCashflow?: number;
    operatingCashflow?: number;
    grossMargins?: number;
    ebitdaMargins?: number;
    operatingMargins?: number;
    profitMargins?: number;
    recommendationKey?: string;
    numberOfAnalystOpinions?: number;
    targetHighPrice?: number;
    targetLowPrice?: number;
    targetMeanPrice?: number;
  };
}

async function getYahooFinanceData(ticker: string): Promise<YahooFinanceData | null> {
  try {
    const result = await yahooFinance.quoteSummary(ticker, {
      modules: ["price", "summaryDetail", "defaultKeyStatistics", "financialData"],
    });
    return result as YahooFinanceData;
  } catch (e) {
    console.error(`Error fetching Yahoo Finance data for ${ticker}:`, e);
    return null;
  }
}

async function getYahooFinanceFcf(ticker: string): Promise<number | null> {
  try {
    const result = await yahooFinance.quoteSummary(ticker, {
      modules: ["financialData"],
    });
    return result.financialData?.freeCashflow ?? null;
  } catch (e) {
    return null;
  }
}

function analyzeThaiStock(data: YahooFinanceData, format: OutputFormat): string {
  const sd = data.summaryDetail || {};
  const dks = data.defaultKeyStatistics || {};
  const fd = data.financialData || {};

  const isBank = sd.marketCap && sd.marketCap > 1e12 && 
    (sd.marketCap / (fd.totalDebt || 1) > 2);

  const cashDebtRatio = (fd.totalCash && fd.totalDebt && fd.totalDebt > 0)
    ? (fd.totalCash / fd.totalDebt)
    : null;

  const metrics: Record<string, string> = {
    "Market Cap": sd.marketCap ? formatMarketCap(sd.marketCap) : "N/A",
    "P/E (Trailing)": sd.trailingPE ? sd.trailingPE.toFixed(2) : "N/A",
    "P/E (Forward)": sd.forwardPE ? sd.forwardPE.toFixed(2) : "N/A",
    "Dividend Yield": sd.dividendYield ? (sd.dividendYield * 100).toFixed(2) + "%" : "N/A",
    "Beta": dks.beta ? dks.beta.toFixed(2) : "N/A",
    "Book Value": dks.bookValue ? dks.bookValue.toFixed(2) : "N/A",
    "P/B": dks.priceToBook ? dks.priceToBook.toFixed(2) : "N/A",
    "Total Cash": fd.totalCash ? formatMarketCap(fd.totalCash) : "N/A",
    "Total Debt": fd.totalDebt ? formatMarketCap(fd.totalDebt) : "N/A",
    "Cash/Debt": cashDebtRatio ? cashDebtRatio.toFixed(2) + "x" : "N/A",
    "ROE": fd.returnOnEquity ? (fd.returnOnEquity * 100).toFixed(1) + "%" : "N/A",
    "ROA": fd.returnOnAssets ? (fd.returnOnAssets * 100).toFixed(1) + "%" : "N/A",
    "Operating Margin": fd.operatingMargins ? (fd.operatingMargins * 100).toFixed(1) + "%" : "N/A",
    "Profit Margin": fd.profitMargins ? (fd.profitMargins * 100).toFixed(1) + "%" : "N/A",
    "Analyst Rating": fd.recommendationKey ? fd.recommendationKey.toUpperCase() : "N/A",
    "Target Price": fd.targetMeanPrice ? fd.targetMeanPrice.toFixed(2) : "N/A",
    "52W Low": sd.fiftyTwoWeekLow ? sd.fiftyTwoWeekLow.toFixed(2) : "N/A",
    "52W High": sd.fiftyTwoWeekHigh ? sd.fiftyTwoWeekHigh.toFixed(2) : "N/A",
  };

  if (format === "json") {
    return JSON.stringify({ ticker: data.price?.regularMarketPrice, metrics }, null, 2);
  }

  const lines = [
    `📊 ${data.price?.regularMarketPrice ? `${data.price.regularMarketPrice.toFixed(2)} ` : ""}— Yahoo Finance Analysis\n`,
  ];

  const col1 = ["Market Cap", "P/E (Trailing)", "P/E (Forward)", "Dividend Yield", "Beta", "Book Value", "P/B"];
  const col2 = ["Total Cash", "Total Debt", "Cash/Debt", "ROE", "ROA", "Operating Margin", "Profit Margin"];
  const col3 = ["Analyst Rating", "Target Price", "52W Low", "52W High"];

  lines.push("Key Metrics:\n");
  for (let i = 0; i < Math.max(col1.length, col2.length, col3.length); i++) {
    const c1 = col1[i] ? `${col1[i]}: ${metrics[col1[i] as keyof typeof metrics]}` : "";
    const c2 = col2[i] ? `${col2[i]}: ${metrics[col2[i] as keyof typeof metrics]}` : "";
    const c3 = col3[i] ? `${col3[i]}: ${metrics[col3[i] as keyof typeof metrics]}` : "";
    const line = [c1, c2, c3].filter(Boolean).join("  |  ");
    if (line) lines.push(`  ${line}`);
  }

  if (fd.recommendationKey) {
    let rating = "";
    switch (fd.recommendationKey) {
      case "strongBuy": rating = "💚 Strong Buy"; break;
      case "buy": rating = "🟢 Buy"; break;
      case "hold": rating = "🟡 Hold"; break;
      case "sell": rating = "🔴 Sell"; break;
      case "strongSell": rating = "💔 Strong Sell"; break;
      default: rating = fd.recommendationKey;
    }
    lines.push(`\nAnalyst Consensus: ${rating}`);
  }

  return lines.join("\n");
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return (value / 1e12).toFixed(2) + "T";
  if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
  return value.toString();
}

export async function analyzeStock(
  ticker: string,
  format: OutputFormat = "text"
): Promise<string> {
  console.log(`📊 Analyzing ${ticker}...`);

  if (isThaiTicker(ticker)) {
    console.log("  Using Yahoo Finance data (Thai market)");
    const yfData = await getYahooFinanceData(ticker);
    if (!yfData) {
      return `❌ Could not fetch data for ${ticker}`;
    }
    return analyzeThaiStock(yfData, format);
  }

  const secClient = new SECClient();
  const cik = await secClient.resolveTickerToCik(ticker);

  if (!cik) {
    return `❌ Could not find CIK for ticker ${ticker}`;
  }

  const companyFacts = await secClient.getCompanyFacts(cik);

  if (!companyFacts) {
    return `❌ Could not fetch SEC data for ${ticker}`;
  }

  const financials = extractFinancialFacts(companyFacts);

  if (!financials || Object.keys(financials).length === 0) {
    return `❌ Could not extract financial data for ${ticker}`;
  }

  const yfFcf = await getYahooFinanceFcf(ticker);
  if (yfFcf !== null) {
    financials["FreeCashFlow"] = {
      value: yfFcf,
      end_date: "",
      form: "",
    };
  }

  const engine = new FormulaEngine(financials);
  const results = engine.evaluateAll();
  const score = engine.getScore();

  secClient.close();

  if (format === "json") {
    return JSON.stringify(
      {
        ticker,
        score,
        results: results.map((r) => ({
          name: r.name,
          status: r.status,
          value: r.value,
          target: r.target,
          message: r.message,
        })),
      },
      null,
      2
    );
  }

  if (format === "telegram") {
    const lines = [`📊 ${ticker} — Buffett Analysis`, `Score: ${score}/10 formulas passed\n`];

    const passed = results.filter((r) => r.status === "PASS");
    const failed = results.filter((r) => r.status === "FAIL");

    if (passed.length > 0) {
      lines.push("✅ Strengths:");
      for (let i = 0; i < Math.min(5, passed.length); i++) {
        lines.push(`  • ${passed[i].name}: ${passed[i].message}`);
      }
      if (passed.length > 5) {
        lines.push(`  +${passed.length - 5} more`);
      }
    }

    if (failed.length > 0) {
      lines.push("\n❌ Concerns:");
      for (let i = 0; i < Math.min(3, failed.length); i++) {
        lines.push(`  • ${failed[i].name}: ${failed[i].message}`);
      }
      if (failed.length > 3) {
        lines.push(`  +${failed.length - 3} more`);
      }
    }

    let verdict: string;
    if (score >= 8) {
      verdict = "Exceptional quality ✨";
    } else if (score >= 6) {
      verdict = "Good quality overall 👍";
    } else if (score >= 4) {
      verdict = "Moderate quality - mixed signals ⚠️";
    } else {
      verdict = "Weak fundamentals ❌";
    }

    lines.push(`\nVerdict: ${verdict}`);

    return lines.join("\n");
  }

  const lines = [
    `📊 ${ticker} — Buffett Analysis`,
    `Score: ${score}/10 formulas passed\n`,
    "Results:",
  ];

  for (const r of results) {
    const symbol = r.status === "PASS" ? "✅" : "❌";
    lines.push(
      `  ${symbol} ${r.name}: ${r.message} (Target: ${r.target})`
    );
  }

  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  let ticker = "";
  let format: OutputFormat = "text";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && i + 1 < args.length) {
      format = args[i + 1] as OutputFormat;
      i++;
    } else if (!ticker) {
      ticker = args[i];
    }
  }

  if (!ticker) {
    console.error("Usage: bun run src/analyze.ts <ticker> [--format text|json|telegram]");
    process.exit(1);
  }

  const result = await analyzeStock(ticker, format);
  console.log(result);
}

if (import.meta.main) {
  main().catch(console.error);
}
