import { describe, expect, it } from "vitest";
import {
  FinanceAccountSchema,
  FinanceOverviewSchema,
  FinanceSimulationCommandSchema,
  FinanceWatchlistCommandSchema,
} from "./finance.js";

const account = {
  id: 1,
  name: "Synthetic test account",
  market: "crypto",
  currency: "USDT",
  snapshotDate: "2026-10-10",
  quality: "available",
  cash: "989.990000000000000001",
  equity: "999.990000000000000001",
  marketValue: "10.0",
  positions: [],
};

describe("financial assistant boundary", () => {
  it("bounds simulation decimal money, market precision, fees and authorization", () => {
    const command = {
      commandType: "simulation.create",
      idempotencyKey: "synthetic-simulation",
      name: "Test only",
      market: "crypto",
      mode: "paper",
      symbols: ["BTCUSDT"],
      ruleId: "crypto_btc_hold",
      initialCash: "1000.00000001",
    };
    expect(FinanceSimulationCommandSchema.safeParse(command).success).toBe(true);
    expect(
      FinanceSimulationCommandSchema.safeParse({ ...command, initialCash: 1000 }).success,
    ).toBe(false);
    expect(
      FinanceSimulationCommandSchema.safeParse({ ...command, initialCash: "1e3" }).success,
    ).toBe(false);
    expect(
      FinanceSimulationCommandSchema.safeParse({ ...command, commissionRate: "0.06" }).success,
    ).toBe(false);
    expect(
      FinanceSimulationCommandSchema.safeParse({
        ...command,
        commissionRate: "0.0500000000000000000000001",
      }).success,
    ).toBe(false);
    expect(
      FinanceSimulationCommandSchema.safeParse({ ...command, initialCash: "1000000000.00000001" })
        .success,
    ).toBe(false);
    expect(
      FinanceSimulationCommandSchema.safeParse({ ...command, sellTaxRate: "0.001" }).success,
    ).toBe(false);
    expect(FinanceSimulationCommandSchema.safeParse({ ...command, market: "cn" }).success).toBe(
      false,
    );
    expect(
      FinanceSimulationCommandSchema.safeParse({ ...command, ownerId: "foreign" }).success,
    ).toBe(false);
    expect(
      FinanceSimulationCommandSchema.safeParse({ ...command, startDate: "2026-02-30" }).success,
    ).toBe(false);
  });
  it("rejects malformed symbol pools, cross-market rules and incomplete backtest ranges", () => {
    const command = {
      commandType: "simulation.create",
      idempotencyKey: "static-contract-key",
      name: "Explicit rule",
      market: "crypto",
      mode: "paper",
      symbols: ["BTCUSDT"],
      ruleId: "crypto_btc_hold",
      initialCash: "1000",
    };
    for (const changes of [
      { symbols: ["../../private"] },
      { symbols: ["BTC"] },
      { symbols: ["btcUSDT"] },
      { symbols: ["ETHUSDT"] },
      { symbols: [`${"A".repeat(17)}USDT`] },
      { ruleId: "high_volume_volatility_grid" },
      { mode: "backtest" },
      { mode: "backtest", startDate: "2026-10-01" },
      { mode: "backtest", startDate: "2026-10-01", endDate: "2026-10-01" },
      { mode: "backtest", startDate: "2022-10-01", endDate: "2026-10-01" },
      { market: "cn", symbols: ["600519"] },
      { market: "cn", ruleId: "high_volume_volatility_grid", symbols: ["600519.SH"] },
    ])
      expect(FinanceSimulationCommandSchema.safeParse({ ...command, ...changes }).success).toBe(
        false,
      );
    expect(
      FinanceSimulationCommandSchema.safeParse({
        ...command,
        mode: "backtest",
        startDate: "2026-10-01",
        endDate: "2026-10-02",
      }).success,
    ).toBe(true);
    expect(
      FinanceSimulationCommandSchema.safeParse({
        ...command,
        market: "cn",
        ruleId: "high_volume_volatility_grid",
        symbols: ["600519"],
      }).success,
    ).toBe(true);
  });
  it("preserves exact decimal strings and rejects floating point money", () => {
    expect(FinanceAccountSchema.parse(account).cash).toBe("989.990000000000000001");
    expect(FinanceAccountSchema.safeParse({ ...account, cash: 989.99 }).success).toBe(false);
    expect(FinanceAccountSchema.safeParse({ ...account, cash: "NaN" }).success).toBe(false);
    expect(FinanceAccountSchema.safeParse({ ...account, cash: "1e-8" }).success).toBe(false);
  });

  it("distinguishes missing balances from zero", () => {
    expect(FinanceAccountSchema.parse({ ...account, cash: null }).cash).toBeNull();
    expect(FinanceAccountSchema.parse({ ...account, cash: "0" }).cash).toBe("0");
  });

  it("does not accept an unavailable service as a successful empty account", () => {
    expect(
      FinanceOverviewSchema.safeParse({ availability: "ready", message: null, data: null }).success,
    ).toBe(false);
    expect(
      FinanceOverviewSchema.parse({
        availability: "unbound",
        message: "Workspace not bound",
        data: null,
      }).availability,
    ).toBe("unbound");
  });

  it("refuses a client supplied workspace or authority on a financial command", () => {
    const command = {
      commandType: "watchlist.add",
      idempotencyKey: "synthetic-key",
      expectedRevision: 0,
      symbol: "BTCUSDT",
      market: "crypto",
    };
    expect(FinanceWatchlistCommandSchema.safeParse(command).success).toBe(true);
    expect(
      FinanceWatchlistCommandSchema.safeParse({ ...command, workspaceId: "foreign-workspace" })
        .success,
    ).toBe(false);
  });
});
