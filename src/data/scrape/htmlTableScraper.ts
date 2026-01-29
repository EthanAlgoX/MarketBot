import * as cheerio from "cheerio";
import type { Candle, Timeframe, WebScraper } from "../types.js";
import { fetchWithTimeout } from "../providers/providerUtils.js";

export class HtmlTableScraper implements WebScraper {
  id = "html_table";

  constructor(private allowlist: string[], private timeoutMs: number = 8000) {}

  async fetch(url: string): Promise<string> {
    const domain = new URL(url).hostname;
    if (this.allowlist.length > 0 && !this.allowlist.some((entry) => domain.endsWith(entry))) {
      throw new Error(`Domain not in SCRAPE_ALLOWLIST: ${domain}`);
    }

    const response = await fetchWithTimeout(url, this.timeoutMs, {
      headers: { "User-Agent": "MarketBot/0.1" },
    });

    if (!response.ok) {
      throw new Error(`Scrape request failed (${response.status}) for ${url}`);
    }
    return response.text();
  }

  extractOHLCV(html: string, _timeframe: Timeframe): Candle[] | null {
    const $ = cheerio.load(html);
    const table = $("table").first();
    if (!table.length) return null;

    const headers = table.find("thead th").map((_idx, el) => normalize($(el).text())).get();
    const colIndex = detectColumns(headers);

    if (!colIndex.open && !colIndex.close) return null;

    const candles: Candle[] = [];
    table.find("tbody tr").each((_idx, row) => {
      const cells = $(row).find("td").map((_i, td) => $(td).text().trim()).get();
      const timeText = cells[colIndex.time ?? 0] ?? "";
      const time = parseTime(timeText);
      const open = parseNumber(cells[colIndex.open ?? -1]);
      const high = parseNumber(cells[colIndex.high ?? -1]);
      const low = parseNumber(cells[colIndex.low ?? -1]);
      const close = parseNumber(cells[colIndex.close ?? -1]);
      const volume = parseNumber(cells[colIndex.volume ?? -1]);

      if (!Number.isFinite(time) || !Number.isFinite(close)) return;
      candles.push({ time, open, high, low, close, volume });
    });

    return candles.sort((a, b) => a.time - b.time);
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function detectColumns(headers: string[]) {
  const find = (names: string[]) => headers.findIndex((h) => names.some((n) => h.includes(n)));
  const index = (value: number) => (value >= 0 ? value : undefined);

  return {
    time: index(find(["date", "time", "timestamp"])),
    open: index(find(["open"])),
    high: index(find(["high"])),
    low: index(find(["low"])),
    close: index(find(["close", "last"])),
    volume: index(find(["volume", "vol"])),
  };
}

function parseTime(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    return trimmed.length === 10 ? num * 1000 : num;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function parseNumber(value?: string): number {
  if (!value) return NaN;
  const cleaned = value.replace(/,/g, "").replace(/%/g, "");
  const num = Number(cleaned);
  return Number.isNaN(num) ? NaN : num;
}
