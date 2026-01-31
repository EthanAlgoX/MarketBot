// Data types for market data providers

export interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

export interface MarketSeries {
    timeframe: string;
    candles: Candle[];
    source: string;
}

// WebScraper interface - flexible to support different implementations
export interface WebScraper {
    id?: string;
    name?: string;
    // Can return either raw HTML (string) or parsed candles
    fetch(urlOrAsset: string, timeframe?: Timeframe): Promise<string | Candle[]>;
    extractOHLCV?(html: string, timeframe: Timeframe): Candle[] | null;
}

export interface DataProviderConfig {
    mode: "mock" | "auto" | "api" | "scrape";
    enableSearch?: boolean;
    apiKey?: string;
    baseUrl?: string;
}
