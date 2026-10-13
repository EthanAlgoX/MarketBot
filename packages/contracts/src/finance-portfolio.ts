import * as z from "zod";
import { IsoDate } from "./ids.js";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const key = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);
const decimal = z
  .string()
  .max(64)
  .regex(/^\d+(?:\.\d+)?$/);
const positiveDecimal = decimal.refine((value) => /[1-9]/.test(value), "Must be positive");
const signedDecimal = z
  .string()
  .max(64)
  .regex(/^-?\d+(?:\.\d+)?$/);
const date = z.iso.date();
const market = z.enum(["cn", "crypto"]);
const currency = z.enum(["CNY", "USDT"]);
const note = z.string().trim().max(255).default("");

/** These accounts retain the original financial repository's Float storage. */
export const FinanceManualAccountSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  market,
  currency,
  ledgerKind: z.literal("manual"),
  assistantCreated: z.literal(true),
  revision,
  ledgerPrecision: z.literal("legacy_float"),
});

export const FinancePortfolioTradeInputSchema = z
  .object({
    externalId: z.string().trim().min(1).max(128),
    tradeDate: date,
    symbol: z.string().trim().min(1).max(32),
    market,
    currency,
    side: z.enum(["buy", "sell"]),
    quantity: positiveDecimal,
    price: positiveDecimal,
    fee: decimal.default("0"),
    tax: decimal.default("0"),
    note,
  })
  .strict();

export const FinancePortfolioPreviewInputSchema = z
  .object({
    accountId: id,
    expectedRevision: revision,
    records: z.array(FinancePortfolioTradeInputSchema).min(1).max(1000),
  })
  .strict();

export const FinancePortfolioPreviewSchema = z.object({
  accountId: id,
  revision,
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  canCommit: z.boolean(),
  insertCount: z.number().int().nonnegative().max(1000),
  duplicateCount: z.number().int().nonnegative().max(1000),
  rows: z
    .array(
      z.object({
        index: z.number().int().nonnegative().max(999),
        status: z.enum(["insert", "duplicate", "conflict", "invalid"]),
        error: z.string().max(2000).nullable(),
        record: FinancePortfolioTradeInputSchema.nullable(),
      }),
    )
    .min(1)
    .max(1000),
  warnings: z.array(z.string().max(2000)).max(32),
});

export const FinancePortfolioCommandTypeSchema = z.enum([
  "portfolio.account.create",
  "portfolio.cash.record",
  "portfolio.trades.import",
]);
export const FinancePortfolioCommandSchema = z.discriminatedUnion("commandType", [
  z
    .object({
      commandType: z.literal("portfolio.account.create"),
      idempotencyKey: key,
      name: z.string().trim().min(1).max(64),
      market,
      currency,
    })
    .strict(),
  z
    .object({
      commandType: z.literal("portfolio.cash.record"),
      idempotencyKey: key,
      accountId: id,
      expectedRevision: revision,
      eventDate: date,
      direction: z.enum(["deposit", "withdraw"]),
      amount: positiveDecimal,
      currency,
      note,
    })
    .strict(),
  FinancePortfolioPreviewInputSchema.extend({
    commandType: z.literal("portfolio.trades.import"),
    idempotencyKey: key,
    previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
]);

const receipt = z.object({
  id: z.string().min(1).max(200),
  idempotencyKey: key,
  status: z.literal("applied"),
});
export const FinancePortfolioCommandResultSchema = z.discriminatedUnion("commandType", [
  receipt.extend({
    commandType: z.literal("portfolio.account.create"),
    result: z.object({ account: FinanceManualAccountSchema }),
  }),
  receipt.extend({
    commandType: z.literal("portfolio.cash.record"),
    result: z.object({
      accountId: id,
      revision,
      cashEntryId: id,
      ledgerPrecision: z.literal("legacy_float"),
    }),
  }),
  receipt.extend({
    commandType: z.literal("portfolio.trades.import"),
    result: z.object({
      accountId: id,
      revision,
      insertedCount: z.number().int().nonnegative().max(1000),
      duplicateCount: z.number().int().nonnegative().max(1000),
      tradeIds: z.array(id).max(1000),
      ledgerPrecision: z.literal("legacy_float"),
    }),
  }),
]);

export const FinancePortfolioCommandStatusInputSchema = z
  .object({ commandType: FinancePortfolioCommandTypeSchema, idempotencyKey: key })
  .strict();
export const FinancePortfolioAccountsSchema = z.object({
  accounts: z.array(FinanceManualAccountSchema).max(1000),
});
export const FinancePortfolioAccountQuerySchema = z.object({ accountId: id }).strict();

export type FinanceManualAccount = z.infer<typeof FinanceManualAccountSchema>;
export type FinancePortfolioTradeInput = z.infer<typeof FinancePortfolioTradeInputSchema>;
export type FinancePortfolioPreviewInput = z.infer<typeof FinancePortfolioPreviewInputSchema>;
export type FinancePortfolioPreview = z.infer<typeof FinancePortfolioPreviewSchema>;
export type FinancePortfolioCommand = z.infer<typeof FinancePortfolioCommandSchema>;
export type FinancePortfolioCommandResult = z.infer<typeof FinancePortfolioCommandResultSchema>;
export type FinancePortfolioAccounts = z.infer<typeof FinancePortfolioAccountsSchema>;

export const FinancePortfolioAccountDetailSchema = z.object({
  account: FinanceManualAccountSchema,
  availableCash: z.null(),
  cashLedgerNet: signedDecimal,
  holdings: z
    .array(
      z.object({
        assetId: z.string().min(1).max(200),
        symbol: z.string().max(32),
        market,
        currency,
        quantity: signedDecimal,
        marketValue: z.null(),
      }),
    )
    .max(1000),
  trades: z
    .array(FinancePortfolioTradeInputSchema.extend({ id, recordedAt: IsoDate.nullable() }))
    .max(1000),
  cashEntries: z
    .array(
      z.object({
        id,
        eventDate: date,
        direction: z.enum(["deposit", "withdraw"]),
        amount: decimal,
        currency,
        note,
        recordedAt: IsoDate.nullable(),
      }),
    )
    .max(1000),
  warnings: z.array(z.string().max(2000)).max(32),
  historyTruncated: z.boolean(),
});
export type FinancePortfolioAccountDetail = z.infer<typeof FinancePortfolioAccountDetailSchema>;
