import { describe, expect, it } from "vitest";
import { FINANCE_TRADE_CSV_HEADER, parseFinanceTradeCsv } from "./finance-portfolio-import.js";

describe("portfolio template CSV", () => {
  it("preserves decimal text, quoted notes and the user's stable transaction identity", () => {
    const result = parseFinanceTradeCsv(
      `\uFEFF${FINANCE_TRADE_CSV_HEADER}\r\ntrade-1,2026-10-10,BTCUSDT,加密,usdt,买入,0.00000001,85000.12345678,,,"含逗号,\n和""引号"""\r\n`,
    );
    expect(result).toEqual([
      {
        externalId: "trade-1",
        tradeDate: "2026-10-10",
        symbol: "BTCUSDT",
        market: "crypto",
        currency: "USDT",
        side: "buy",
        quantity: "0.00000001",
        price: "85000.12345678",
        fee: "0",
        tax: "0",
        note: '含逗号,\n和"引号"',
      },
    ]);
  });
  it("accepts mapped English headers without inferring missing financial fields", () => {
    expect(
      parseFinanceTradeCsv(
        "externalId,tradeDate,symbol,market,currency,side,quantity,price\nabc,2026-10-10,600519,cn,CNY,buy,100,1600",
      )[0],
    ).toMatchObject({ symbol: "600519", quantity: "100" });
    for (const csv of [
      "tradeDate,symbol\n2026-10-10,BTC",
      `${FINANCE_TRADE_CSV_HEADER}\nx,2026-10-10,BTCUSDT,crypto,USDT,buy,1e-8,85000,0,0,`,
      `${FINANCE_TRADE_CSV_HEADER}\nx,2026-10-10,BTCUSDT,crypto,USDT,buy,0.1,85000,0,0`,
      `${FINANCE_TRADE_CSV_HEADER}\nx,2026-10-10,BTCUSDT,crypto,USDT,buy,0.1,85000,0,0,"broken`,
    ])
      expect(() => parseFinanceTradeCsv(csv)).toThrow();
  });
  it("bounds parsed row counts and UTF-8 byte size before use", () => {
    expect(() => parseFinanceTradeCsv("中".repeat(180000))).toThrow(/512/);
    const row = "x,2026-10-10,BTCUSDT,crypto,USDT,buy,0.1,85000,0,0,";
    expect(() =>
      parseFinanceTradeCsv(`${FINANCE_TRADE_CSV_HEADER}\n${Array(1001).fill(row).join("\n")}`),
    ).toThrow(/1000/);
  });
});
