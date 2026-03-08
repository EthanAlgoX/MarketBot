import { getTickers, getMarketName, Market } from "./tickers.js";
import { PriceDataFetcherSimple } from "./priceDataSimple.js";
import { calculateWilliamsR } from "./technicalIndicators.js";
import { SECClient, extractFinancialFacts } from "./secApi.js";
import { FormulaEngine } from "./formulas.js";
import { OHLC } from "./database.js";

export interface OversoldStock {
  ticker: string;
  williamsR: number;
  priceData: OHLC[];
}

export interface QualityStock {
  ticker: string;
  williamsR: number;
  buffettScore: number;
  techScore: number;
  fundamentalScore: number;
  combinedScore: number;
}

export interface ScreeningResult {
  totalScanned: number;
  oversoldCount: number;
  qualityCount: number;
  minBuffettScore: number;
  topStocks: QualityStock[];
  market: Market;
}

export type OutputFormat = "text" | "json" | "telegram";

export async function runCombinedScreening(
  market: Market = "us",
  minBuffettScore: number = 5,
  topN: number = 10,
  format: OutputFormat = "text"
): Promise<string> {
  const marketName = getMarketName(market);
  const hasFundamentals = market === "us";

  console.log(
    `📊 Running combined screening (${marketName}, min Buffett score: ${minBuffettScore})...`
  );

  const tickers = await getTickers(market);
  console.log(`  Found ${tickers.length} tickers`);

  console.log("  Phase 1: Technical screening...");
  const fetcher = new PriceDataFetcherSimple();
  const priceResults = await fetcher.batchFetchPrices(tickers, 90);

  const oversoldStocks: OversoldStock[] = [];
  for (const [ticker, result] of Object.entries(priceResults)) {
    if (!result.success || !result.data) continue;

    const williamsR = calculateWilliamsR(result.data, 21);
    const latestWr = williamsR[williamsR.length - 1];

    if (latestWr && latestWr < -80) {
      oversoldStocks.push({
        ticker,
        williamsR: latestWr,
        priceData: result.data,
      });
    }
  }

  console.log(`  Found ${oversoldStocks.length} oversold stocks`);

  let qualityStocks: QualityStock[];

  if (!hasFundamentals) {
    console.log("  Phase 2: Skipping fundamental screening (Thai market - no SEC data)");
    qualityStocks = oversoldStocks.map((stock) => ({
      ticker: stock.ticker,
      williamsR: stock.williamsR,
      buffettScore: 0,
      techScore: (stock.williamsR + 100) / 100,
      fundamentalScore: 0,
      combinedScore: (stock.williamsR + 100),
    }));
  } else {
    console.log("  Phase 2: Fundamental screening...");
    qualityStocks = [];
    const secClient = new SECClient();

    for (const stock of oversoldStocks) {
      const ticker = stock.ticker;

      const cik = await secClient.resolveTickerToCik(ticker);
      if (!cik) continue;

      const companyFacts = await secClient.getCompanyFacts(cik);
      if (!companyFacts) continue;

      const financials = extractFinancialFacts(companyFacts);
      if (!financials || Object.keys(financials).length === 0) continue;

      const engine = new FormulaEngine(financials);
      const buffettScore = engine.getScore();

      if (buffettScore >= minBuffettScore) {
        const techScore = (stock.williamsR + 100) / 100;
        const fundamentalScore = (buffettScore / 10) * 100;
        const combinedScore = techScore * 0.3 + fundamentalScore * 0.7;

        qualityStocks.push({
          ticker,
          williamsR: stock.williamsR,
          buffettScore,
          techScore,
          fundamentalScore,
          combinedScore,
        });
      }
    }

    secClient.close();
  }

  qualityStocks.sort((a, b) => b.combinedScore - a.combinedScore);

  console.log(`  Found ${qualityStocks.length} quality stocks`);

  if (format === "json") {
    return JSON.stringify(
      {
        totalScanned: tickers.length,
        oversoldCount: oversoldStocks.length,
        qualityCount: qualityStocks.length,
        minBuffettScore,
        market,
        topStocks: qualityStocks.slice(0, topN),
      },
      null,
      2
    );
  }

  if (format === "telegram") {
    const lines = [
      `📊 Combined Quality Screening (${marketName})`,
      `Scanned: ${tickers.length} stocks`,
      `Oversold: ${oversoldStocks.length}`,
      hasFundamentals
        ? `Quality (Buffett ≥${minBuffettScore}/10): ${qualityStocks.length}`
        : `Oversold (Technical only - no SEC data): ${qualityStocks.length}\n`,
    ];

    if (qualityStocks.length > 0) {
      lines.push("🌟 Top 10 Quality Opportunities:\n");

      for (let i = 0; i < Math.min(10, qualityStocks.length); i++) {
        const stock = qualityStocks[i];
        if (hasFundamentals) {
          lines.push(
            `${i + 1}. **${stock.ticker}** — Combined: ${stock.combinedScore.toFixed(0)}% ` +
              `| Buffett: ${stock.buffettScore}/10 | WR: ${stock.williamsR.toFixed(1)}`
          );
        } else {
          lines.push(
            `${i + 1}. **${stock.ticker}** — WR: ${stock.williamsR.toFixed(1)}`
          );
        }
      }
    } else {
      lines.push("❌ No quality stocks found matching criteria");
    }

    return lines.join("\n");
  }

  const lines = [
    `📊 Combined Quality Screening (${marketName})`,
    hasFundamentals
      ? "Technical: Oversold signals (Williams %R < -80)"
      : "Technical: Oversold signals (Williams %R < -80) - Thai Market",
    hasFundamentals
      ? "Fundamental: Warren Buffett's 10 formulas on SEC data"
      : "Fundamental: Not available (Thai stocks not in SEC)",
    hasFundamentals
      ? `Minimum Buffett Score: ${minBuffettScore}/10\n`
      : "\n",
    "Results:",
  ];

  lines.push(`  Total Scanned: ${tickers.length}`);
  lines.push(`  Oversold Found: ${oversoldStocks.length}`);
  lines.push(
    hasFundamentals
      ? `  Quality Stocks: ${qualityStocks.length} (Buffett ≥${minBuffettScore}/10)\n`
      : `  Oversold Stocks: ${qualityStocks.length}\n`
  );

  if (qualityStocks.length > 0) {
    lines.push(
      `Top ${Math.min(topN, qualityStocks.length)} Opportunities:\n`
    );

    for (let i = 0; i < Math.min(topN, qualityStocks.length); i++) {
      const stock = qualityStocks[i];
      if (hasFundamentals) {
        lines.push(
          `${i + 1}. ${stock.ticker.padEnd(6)} — Combined: ${stock.combinedScore.toFixed(1).padStart(5)}% ` +
            `| Buffett: ${stock.buffettScore}/10 | WR: ${stock.williamsR.toFixed(1)}`
        );
      } else {
        lines.push(
          `${i + 1}. ${stock.ticker.padEnd(10)} — Williams %R: ${stock.williamsR.toFixed(1)}`
        );
      }
    }
  } else {
    lines.push("  No quality stocks found matching criteria");
  }

  if (hasFundamentals) {
    lines.push("\nScoring: 30% technical + 70% fundamental");
  }

  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  let market: Market = "us";
  let minBuffettScore = 5;
  let topN = 10;
  let format: OutputFormat = "text";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--market" && i + 1 < args.length) {
      const marketArg = args[i + 1].toLowerCase();
      if (marketArg === "us" || marketArg === "bk") {
        market = marketArg;
      } else {
        console.error("Invalid market. Use 'us' or 'bk'");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--min-score" && i + 1 < args.length) {
      minBuffettScore = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--top-n" && i + 1 < args.length) {
      topN = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--format" && i + 1 < args.length) {
      format = args[i + 1] as OutputFormat;
      i++;
    }
  }

  const result = await runCombinedScreening(market, minBuffettScore, topN, format);
  console.log(result);
}

if (import.meta.main) {
  main().catch(console.error);
}
