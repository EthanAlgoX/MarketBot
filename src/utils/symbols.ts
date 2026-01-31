// Symbol resolution helpers

const NAME_TO_SYMBOL: Array<[string, string]> = [
  ["谷歌", "GOOGL"],
  ["google", "GOOGL"],
  ["alphabet", "GOOGL"],
  ["苹果", "AAPL"],
  ["apple", "AAPL"],
  ["微软", "MSFT"],
  ["microsoft", "MSFT"],
  ["特斯拉", "TSLA"],
  ["tesla", "TSLA"],
  ["亚马逊", "AMZN"],
  ["amazon", "AMZN"],
  ["英伟达", "NVDA"],
  ["nvidia", "NVDA"],
  ["meta", "META"],
  ["facebook", "META"],
];

const CRYPTO_TO_YAHOO: Record<string, string> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
  XRP: "XRP-USD",
  ADA: "ADA-USD",
  DOGE: "DOGE-USD",
  BNB: "BNB-USD",
};

export function resolveSymbolFromText(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const upper = trimmed.toUpperCase();
  const tickerMatch = upper.match(/\b([A-Z]{1,6})\b/);
  if (tickerMatch) {
    return tickerMatch[1];
  }

  const lower = trimmed.toLowerCase();
  for (const [name, symbol] of NAME_TO_SYMBOL) {
    if (lower.includes(name)) {
      return symbol;
    }
  }

  return undefined;
}

export function normalizeYahooSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (!upper) return upper;
  if (CRYPTO_TO_YAHOO[upper]) return CRYPTO_TO_YAHOO[upper];
  if (upper.includes("-") || upper.includes("=") || upper.includes("^")) return upper;
  if (/^[A-Z]{6}$/.test(upper)) {
    return `${upper}=X`;
  }
  return upper;
}
