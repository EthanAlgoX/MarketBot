import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TICKER_FILE = join(__dirname, "..", "scripts", "set.txt");
const MAX_TICKER_LENGTH = 10;

function loadTickers(): string[] {
  const tickers: string[] = [];
  if (existsSync(TICKER_FILE)) {
    const content = readFileSync(TICKER_FILE, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 2) {
      const line = lines[i].trim();
      if (line && line.length <= MAX_TICKER_LENGTH) {
        tickers.push(`${line}.BK`);
      }
    }
  }
  return tickers;
}

export const POPULAR_SET_TICKERS = loadTickers();

export function getThaiTickers(): string[] {
  return POPULAR_SET_TICKERS;
}

export function getTickerSymbol(ticker: string): string {
  return ticker.replace(".BK", "");
}

export function isThaiTicker(ticker: string): boolean {
  return ticker.toUpperCase().endsWith(".BK");
}

if (import.meta.main) {
  const tickers = getThaiTickers();
  console.log(`Found ${tickers.length} Thai SET tickers`);
  console.log(tickers.slice(0, 10), "...");
}
