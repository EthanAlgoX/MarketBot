import { getTickers, getMarketName, Market } from "./tickers.js";
import { PriceDataFetcherSimple } from "./priceDataSimple.js";
import {
  calculateWilliamsR,
  calculateEMA,
  interpretWilliamsR,
  WilliamsRInterpretation,
} from "./technicalIndicators.js";

export interface OversoldStock {
  ticker: string;
  williamsR: number;
  williamsREMA: number;
  signal: WilliamsRInterpretation;
}

export type OutputFormat = "text" | "json" | "telegram";

export async function runTechnicalScreening(
  market: Market = "us",
  threshold: number = -80,
  topN: number = 20,
  format: OutputFormat = "text"
): Promise<string> {
  const marketName = getMarketName(market);

  console.log(
    `📊 Scanning ${marketName} for oversold stocks (threshold: ${threshold})...`
  );

  const tickers = await getTickers(market);
  console.log(`  Found ${tickers.length} tickers`);

  console.log("  Fetching price data...");
  const fetcher = new PriceDataFetcherSimple();
  const priceResults = await fetcher.batchFetchPrices(tickers, 90);

  console.log("  Calculating Williams %R...");
  const oversoldStocks: OversoldStock[] = [];

  for (const [ticker, result] of Object.entries(priceResults)) {
    if (!result.success || !result.data) continue;

    const williamsR = calculateWilliamsR(result.data, 21);
    const latestWr = williamsR[williamsR.length - 1];

    if (latestWr && latestWr < threshold) {
      const wrEma = calculateEMA(williamsR.filter((v) => !isNaN(v)), 13);
      const latestEma = wrEma[wrEma.length - 1];

      oversoldStocks.push({
        ticker,
        williamsR: latestWr,
        williamsREMA: latestEma || 0,
        signal: interpretWilliamsR(latestWr),
      });
    }
  }

  oversoldStocks.sort((a, b) => a.williamsR - b.williamsR);

  if (format === "json") {
    return JSON.stringify(
      {
        totalScanned: tickers.length,
        oversoldCount: oversoldStocks.length,
        threshold,
        market,
        topStocks: oversoldStocks.slice(0, topN),
      },
      null,
      2
    );
  }

  if (format === "telegram") {
    const lines = [
      `📊 Technical Oversold Scan (${marketName})`,
      `Scanned: ${tickers.length} stocks`,
      `Found: ${oversoldStocks.length} oversold (${threshold})\n`,
    ];

    if (oversoldStocks.length > 0) {
      lines.push("🔴 Most Oversold (Top 10):\n");

      for (let i = 0; i < Math.min(10, oversoldStocks.length); i++) {
        const stock = oversoldStocks[i];
        lines.push(
          `${i + 1}. **${stock.ticker}** — Williams %R: ${stock.williamsR.toFixed(1)} 🔴`
        );
      }

      if (oversoldStocks.length > 10) {
        lines.push(`\n+ ${oversoldStocks.length - 10} more`);
      }
    } else {
      lines.push("✅ No oversold stocks found");
    }

    return lines.join("\n");
  }

  const lines = [
    `📊 Technical Oversold Scan (${marketName})`,
    `Scanned: ${tickers.length} stocks`,
    `Found: ${oversoldStocks.length} oversold (threshold: ${threshold})\n`,
  ];

  if (oversoldStocks.length > 0) {
    lines.push(
      `Top ${Math.min(topN, oversoldStocks.length)} Most Oversold:\n`
    );

    for (let i = 0; i < Math.min(topN, oversoldStocks.length); i++) {
      const stock = oversoldStocks[i];
      const tickerPad = market === "bk" ? 10 : 6;
      lines.push(
        `${i + 1}. ${stock.ticker.padEnd(tickerPad)} — Williams %R: ${stock.williamsR.toFixed(1).padStart(6)} ` +
          `(EMA: ${stock.williamsREMA.toFixed(1).padStart(6)})`
      );
    }

    if (oversoldStocks.length > topN) {
      lines.push(`\n+ ${oversoldStocks.length - topN} more oversold stocks`);
    }
  } else {
    lines.push("✅ No oversold stocks found - market looks healthy!");
  }

  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  let market: Market = "us";
  let threshold = -80;
  let topN = 20;
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
    } else if (args[i] === "--threshold" && i + 1 < args.length) {
      threshold = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === "--top-n" && i + 1 < args.length) {
      topN = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--format" && i + 1 < args.length) {
      format = args[i + 1] as OutputFormat;
      i++;
    }
  }

  const result = await runTechnicalScreening(market, threshold, topN, format);
  console.log(result);
}

if (import.meta.main) {
  main().catch(console.error);
}
