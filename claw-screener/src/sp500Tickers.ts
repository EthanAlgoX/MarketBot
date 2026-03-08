const SP500_CSV_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";

export async function getSp500Tickers(): Promise<string[]> {
  const response = await fetch(SP500_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch S&P 500 data: ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  const symbolIndex = headers.indexOf("Symbol");

  if (symbolIndex === -1) {
    throw new Error("Symbol column not found in CSV");
  }

  const tickers: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols[symbolIndex]) {
      tickers.push(cols[symbolIndex].trim());
    }
  }

  return tickers;
}

if (import.meta.main) {
  getSp500Tickers()
    .then((tickers) => {
      console.log(`Found ${tickers.length} S&P 500 tickers`);
      console.log(tickers.slice(0, 10), "...");
    })
    .catch(console.error);
}
