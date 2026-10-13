import { describe, expect, it } from "vitest";
import { FinanceSimulationCreateSchema } from "./finance.js";
import {
  FinanceObservationInputSchema,
  FinanceObservationSchema,
  FinanceRuleDraftConfigurationSchema,
  FinanceRuleDraftInputSchema,
} from "./finance-research.js";

const configuration = {
  name: "Explicit BTC rule",
  market: "crypto",
  mode: "paper",
  symbols: ["BTCUSDT"],
  ruleId: "crypto_btc_hold",
  initialCash: "1000",
  commissionRate: "0.001",
  slippageRate: "0.0005",
  sellTaxRate: "0",
};
describe("research observations and saved rule draft boundaries", () => {
  it("keeps older observation inputs and readings compatible without inventing invalidation", () => {
    const input = {
      requestId: "task",
      idempotencyKey: "legacy-intent",
      note: "Original note",
      validUntil: null,
    };
    expect(FinanceObservationInputSchema.parse(input).invalidationCondition).toBeNull();
    expect(
      FinanceObservationSchema.parse({
        ...input,
        id: "observation",
        summary: null,
        createdAt: "2026-10-12T00:00:00Z",
      }).invalidationCondition,
    ).toBeNull();
    expect(
      FinanceObservationInputSchema.safeParse({
        ...input,
        invalidationCondition: " ",
        userId: "forged",
      }).success,
    ).toBe(false);
    expect(
      FinanceObservationInputSchema.safeParse({ ...input, invalidationCondition: "x".repeat(1001) })
        .success,
    ).toBe(false);
  });
  it("uses identical decimal and cross-field validation to simulation creation", () => {
    for (const changes of [
      {},
      { initialCash: "1000.000000001" },
      { commissionRate: "0.050000000000001" },
      { sellTaxRate: "0.01" },
      { startDate: "2026-10-12", endDate: "2026-10-01" },
      { startDate: "2026-02-30" },
      { symbols: ["../../private"] },
      { symbols: ["BTC"] },
      { mode: "backtest" },
      { market: "cn", ruleId: "crypto_btc_hold", symbols: ["600519"] },
    ]) {
      const value = { ...configuration, ...changes };
      expect(FinanceRuleDraftConfigurationSchema.safeParse(value).success).toBe(
        FinanceSimulationCreateSchema.safeParse({
          ...value,
          commandType: "simulation.create",
          idempotencyKey: "comparison-intent",
        }).success,
      );
    }
  });
  it("rejects executable or forged authority fields in a draft", () => {
    const input = {
      observationId: "owned-observation",
      idempotencyKey: "draft-intent",
      configuration,
    };
    expect(FinanceRuleDraftInputSchema.safeParse(input).success).toBe(true);
    expect(FinanceRuleDraftInputSchema.safeParse({ ...input, userId: "forged" }).success).toBe(
      false,
    );
    expect(
      FinanceRuleDraftInputSchema.safeParse({
        ...input,
        configuration: { ...configuration, commandType: "simulation.create" },
      }).success,
    ).toBe(false);
    expect(
      FinanceRuleDraftInputSchema.safeParse({
        ...input,
        configuration: { ...configuration, idempotencyKey: "execution-key" },
      }).success,
    ).toBe(false);
  });
});
