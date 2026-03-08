export type Market = "us" | "bk";

export async function getTickers(market: Market): Promise<string[]> {
  if (market === "us") {
    const { getSp500Tickers } = await import("./sp500Tickers.js");
    return getSp500Tickers();
  } else {
    const { getThaiTickers } = await import("./thaiTickers.js");
    return getThaiTickers();
  }
}

export function getMarketName(market: Market): string {
  return market === "us" ? "US (S&P 500)" : "Thailand (SET)";
}

export function getMarketSuffix(market: Market): string {
  return market === "us" ? "" : ".BK";
}
