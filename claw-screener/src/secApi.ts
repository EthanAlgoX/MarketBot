import { SECDataManager, SECData } from "./database.js";

const BASE_URL = "https://data.sec.gov/api/xbrl";
const RATE_LIMIT_DELAY = 100;

const DEFAULT_HEADERS = {
  "User-Agent": "OpenClawStockScreener/1.0 (stock-screener@example.com)",
  Accept: "application/json",
  From: "stock-screener@example.com",
};

interface CompanyFactsResponse {
  facts?: {
    "us-gaap"?: Record<string, { units: Record<string, unknown[]> }>;
  };
}

interface TickerEntry {
  ticker: string;
  cik_str: number;
}

interface CompanyTickerResponse {
  [key: string]: TickerEntry;
}

export interface FinancialMetric {
  value: number;
  end_date: string;
  form: string;
}

export interface Financials {
  [key: string]: FinancialMetric;
}

export class SECClient {
  private headers: Record<string, string>;
  private cache: SECDataManager;
  private tickerCikCache: Map<string, string>;
  private lastRequestTime: number = 0;

  constructor(
    userAgent: string = "OpenClawStockScreener/1.0 (stock-screener@example.com)",
    cacheDb: string = "sec_cache.db"
  ) {
    this.headers = { ...DEFAULT_HEADERS, "User-Agent": userAgent };
    this.cache = new SECDataManager(cacheDb);
    this.tickerCikCache = new Map();
  }

  private async makeRequest(url: string): Promise<unknown> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();

    try {
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      return await response.json();
    } catch (e) {
      console.error(`Error fetching ${url}:`, e);
      return null;
    }
  }

  async getCompanyFacts(
    cik: string,
    forceRefresh: boolean = false
  ): Promise<CompanyFactsResponse | null> {
    if (!forceRefresh) {
      const cached = await this.cache.getData(cik);
      if (cached) {
        return cached as CompanyFactsResponse;
      }
    }

    const url = `${BASE_URL}/companyfacts/CIK${cik}.json`;
    const data = (await this.makeRequest(url)) as CompanyFactsResponse | null;

    if (data) {
      this.cache.storeData(cik, data as unknown as SECData);
    }

    return data;
  }

  async resolveTickerToCik(ticker: string): Promise<string | null> {
    const tickerUpper = ticker.toUpperCase();
    if (this.tickerCikCache.has(tickerUpper)) {
      return this.tickerCikCache.get(tickerUpper) ?? null;
    }

    const url = "https://www.sec.gov/files/company_tickers.json";
    const data = (await this.makeRequest(url)) as CompanyTickerResponse | null;

    if (!data) return null;

    for (const entry of Object.values(data)) {
      if (entry.ticker === tickerUpper) {
        const cik = String(entry.cik_str).padStart(10, "0");
        this.tickerCikCache.set(tickerUpper, cik);
        return cik;
      }
    }

    return null;
  }

  close(): void {
    this.cache.close();
  }
}

export function extractFinancialFacts(companyFacts: CompanyFactsResponse): Financials {
  const facts = companyFacts.facts?.["us-gaap"] ?? {};
  const result: Financials = {};

  const tags: Record<string, string> = {
    Assets: "Assets",
    Liabilities: "Liabilities",
    StockholdersEquity: "StockholdersEquity",
    CashAndCashEquivalentsAtCarryingValue:
      "CashAndCashEquivalentsAtCarryingValue",
    NetIncomeLoss: "NetIncomeLoss",
    Revenues: "Revenues",
    OperatingIncomeLoss: "OperatingIncomeLoss",
    CashFlowFromContinuingOperatingActivities:
      "CashFlowFromContinuingOperatingActivities",
    InterestExpense: "InterestExpense",
    CurrentAssets: "AssetsCurrent",
    CurrentLiabilities: "LiabilitiesCurrent",
    LongTermDebt: "LongTermDebt",
    ShortTermDebt: "ShortTermDebt",
  };

  for (const [label, tag] of Object.entries(tags)) {
    if (tag in facts) {
      const tagData = facts[tag];
      const units = tagData.units;
      if (units && "USD" in units) {
        const recentValue = (units["USD"] as Record<string, unknown>[])[0];
        result[label] = {
          value: recentValue["val"] as number,
          end_date: recentValue["end"] as string,
          form: (recentValue["form"] as string) ?? "10-K",
        };
      }
    }
  }

  return result;
}

if (import.meta.main) {
  const client = new SECClient();

  client
    .resolveTickerToCik("AAPL")
    .then((cik) => {
      if (cik) {
        console.log(`Apple CIK: ${cik}`);
        return client.getCompanyFacts(cik);
      }
      return null;
    })
    .then((facts) => {
      if (facts) {
        const financials = extractFinancialFacts(facts);
        console.log(`\nExtracted ${Object.keys(financials).length} metrics:`);
        for (const [key, val] of Object.entries(financials).slice(0, 5)) {
          console.log(`  ${key}: ${val}`);
        }
      }
      client.close();
    })
    .catch(console.error);
}
