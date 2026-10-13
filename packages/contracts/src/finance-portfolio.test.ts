import { describe, expect, it } from "vitest";
import {
  FinancePortfolioAccountDetailSchema,
  FinancePortfolioCommandSchema,
  FinancePortfolioPreviewInputSchema,
} from "./finance-portfolio.js";

const record = {
  externalId: "csv-row-1",
  tradeDate: "2026-10-10",
  symbol: "BTCUSDT",
  market: "crypto",
  currency: "USDT",
  side: "buy",
  quantity: "0.00000001",
  price: "85000.12345678",
};

describe("manual portfolio contracts", () => {
  it("keeps decimal input text and refuses implicit numeric coercion", () => {
    const parsed = FinancePortfolioPreviewInputSchema.parse({
      accountId: 1,
      expectedRevision: 0,
      records: [record],
    });
    expect(parsed.records[0]).toMatchObject({
      quantity: "0.00000001",
      price: "85000.12345678",
      fee: "0",
      tax: "0",
    });
    for (const quantity of [0.1, "0", "-0.1", "1e-8", "NaN", "1".repeat(65)]) {
      expect(
        FinancePortfolioPreviewInputSchema.safeParse({
          accountId: 1,
          expectedRevision: 0,
          records: [{ ...record, quantity }],
        }).success,
      ).toBe(false);
    }
  });

  it("does not accept client ownership or simulation account selectors", () => {
    const command = {
      commandType: "portfolio.trades.import",
      idempotencyKey: "import-test-1",
      accountId: 1,
      expectedRevision: 0,
      previewHash: "a".repeat(64),
      records: [record],
    };
    expect(FinancePortfolioCommandSchema.safeParse(command).success).toBe(true);
    for (const field of ["subject", "userId", "workspaceId", "simulationAccountId"]) {
      expect(
        FinancePortfolioCommandSchema.safeParse({ ...command, [field]: "other" }).success,
      ).toBe(false);
    }
    expect(
      FinancePortfolioCommandSchema.safeParse({ ...command, previewHash: "changed" }).success,
    ).toBe(false);
  });

  it("bounds imports and refuses impossible business dates", () => {
    const input = { accountId: 1, expectedRevision: 0, records: [record] };
    expect(
      FinancePortfolioPreviewInputSchema.safeParse({ ...input, records: Array(1001).fill(record) })
        .success,
    ).toBe(false);
    expect(
      FinancePortfolioPreviewInputSchema.safeParse({
        ...input,
        records: [{ ...record, tradeDate: "2026-02-31" }],
      }).success,
    ).toBe(false);
  });

  it("cannot project manual cash or storage as a verified broker balance or Decimal ledger", () => {
    const detail = {
      account: {
        id: 1,
        name: "Manual",
        market: "crypto",
        currency: "USDT",
        ledgerKind: "manual",
        assistantCreated: true,
        revision: 0,
        ledgerPrecision: "legacy_float",
      },
      availableCash: null,
      cashLedgerNet: "1000",
      holdings: [],
      trades: [],
      cashEntries: [],
      warnings: [],
      historyTruncated: false,
    };
    expect(FinancePortfolioAccountDetailSchema.safeParse(detail).success).toBe(true);
    expect(
      FinancePortfolioAccountDetailSchema.safeParse({ ...detail, availableCash: "1000" }).success,
    ).toBe(false);
    expect(
      FinancePortfolioAccountDetailSchema.safeParse({
        ...detail,
        account: { ...detail.account, ledgerPrecision: "decimal_v1" },
      }).success,
    ).toBe(false);
  });
});
