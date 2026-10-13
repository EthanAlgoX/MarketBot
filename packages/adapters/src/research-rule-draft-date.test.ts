import { FinanceRuleDraftConfigurationSchema } from "@marketbot/contracts";
import { describe, expect, it } from "vitest";
import { validateRuleDraftMarketDate } from "./research-observations.js";

const configuration = FinanceRuleDraftConfigurationSchema.parse({
  name: "Boundary only",
  market: "crypto",
  mode: "backtest",
  ruleId: "crypto_btc_hold",
  symbols: ["BTCUSDT"],
  initialCash: "1000",
  startDate: "2026-10-11",
  endDate: "2026-10-12",
});
describe("draft market dates", () => {
  it("uses UTC closed dates for crypto and Shanghai dates for A shares", () => {
    const now = new Date("2026-10-12T23:30:00Z");
    expect(() => validateRuleDraftMarketDate(configuration, now)).toThrow("已收盘");
    expect(() =>
      validateRuleDraftMarketDate(
        {
          ...configuration,
          market: "cn",
          ruleId: "high_volume_volatility_grid",
          symbols: ["600519"],
        },
        now,
      ),
    ).not.toThrow();
  });
  it("checks every request time instead of freezing a date during module loading", () => {
    expect(() =>
      validateRuleDraftMarketDate(configuration, new Date("2026-10-12T23:59:59Z")),
    ).toThrow();
    expect(() =>
      validateRuleDraftMarketDate(configuration, new Date("2026-10-13T00:00:00Z")),
    ).not.toThrow();
  });
  it("does not claim that a paper draft's planned dates are an executed or frozen interval", () => {
    expect(() =>
      validateRuleDraftMarketDate(
        { ...configuration, mode: "paper" },
        new Date("2026-10-10T00:00:00Z"),
      ),
    ).not.toThrow();
  });
});
