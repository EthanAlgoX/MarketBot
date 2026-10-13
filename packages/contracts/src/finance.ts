import * as z from "zod";
import { IsoDate } from "./ids.js";

/** Money never crosses the assistant boundary as a JavaScript number. */
export const FinanceDecimalSchema = z.string().regex(/^-?\d+(?:\.\d+)?$/);
const optionalAmount = FinanceDecimalSchema.nullable();
const financialId = z.number().int().nonnegative();
export const FinanceQualitySchema = z.enum(["available", "stale", "missing"]);

export const FinanceAssetSchema = z.object({
  assetId: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string(),
  market: z.string(),
  currency: z.string(),
  reason: z.string().max(1000).default(""),
});

export const FinancePositionSchema = z.object({
  assetId: z.string().min(1),
  symbol: z.string(),
  market: z.string(),
  currency: z.string(),
  quantity: optionalAmount,
  averageCost: optionalAmount,
  lastPrice: optionalAmount,
  marketValue: optionalAmount,
});

export const FinanceAccountSchema = z.object({
  id: financialId,
  name: z.string(),
  market: z.string(),
  currency: z.string(),
  snapshotDate: z.string().nullable(),
  quality: FinanceQualitySchema,
  cash: optionalAmount,
  equity: optionalAmount,
  marketValue: optionalAmount,
  positions: z.array(FinancePositionSchema),
});

export const FinanceReportSchema = z.object({
  id: financialId,
  assetId: z.string(),
  symbol: z.string(),
  name: z.string(),
  createdAt: IsoDate.nullable(),
  summary: z.string(),
  advice: z.string().nullable(),
  quality: FinanceQualitySchema,
});

export const FinanceRunSchema = z.object({
  id: financialId,
  name: z.string(),
  market: z.string(),
  mode: z.string(),
  status: z.string(),
  lastTradingDate: z.string().nullable(),
  nextCheckAt: IsoDate.nullable(),
  executionPrecision: z.literal("day"),
  decisionBackend: z.string(),
  currency: z.string(),
  cash: optionalAmount,
  equity: optionalAmount,
  revision: z.number().int().nonnegative().default(0),
  ledgerPrecision: z.enum(["decimal_v1", "legacy_float"]).default("legacy_float"),
});

export const FinanceRunDetailSchema = FinanceRunSchema.extend({
  days: z.array(
    z.object({
      tradingDate: z.string(),
      recordId: z.number().int().positive(),
      recordedAt: IsoDate.nullable(),
      inputSources: z.record(z.string(), z.string()),
      cash: optionalAmount,
      marketValue: optionalAmount,
      equity: optionalAmount,
      trades: z.array(
        z.object({
          symbol: z.string(),
          side: z.string(),
          status: z.string(),
          quantity: optionalAmount,
          price: optionalAmount,
          fee: optionalAmount,
          slippage: optionalAmount,
          reason: z.string().nullable(),
          signalDate: z.string().nullable(),
          orderId: z.number().int().positive().nullable(),
          fillId: z.number().int().positive().nullable(),
        }),
      ),
      holdings: z.array(
        z.object({
          symbol: z.string(),
          quantity: optionalAmount,
          averageCost: optionalAmount,
        }),
      ),
    }),
  ),
  metrics: z.record(z.string(), optionalAmount),
  quality: z.enum(["available", "missing"]),
  evaluatedTradingDays: z.number().int().nonnegative(),
  displayedTradingDays: z.number().int().nonnegative(),
  historyTruncated: z.boolean(),
  statisticsPrecision: z.literal("derived_float"),
  strategyRef: z.object({
    strategyVersionId: z.number().int().positive(),
    ruleId: z.string().nullable(),
    version: z.string().nullable(),
    digest: z.string().nullable(),
  }),
  decimalRules: z.json().nullable(),
});

export const FinanceWorkspaceOverviewSchema = z.object({
  schemaVersion: z.literal("1"),
  status: z.literal("ready"),
  asOf: IsoDate,
  capabilities: z.object({
    liveTrading: z.literal(false),
    simulationPrecision: z.literal("day"),
    readOnly: z.boolean(),
    supportedCommands: z.array(z.string().max(100)).max(32).default([]),
  }),
  watchlist: z.array(FinanceAssetSchema),
  watchlistRevision: z.number().int().nonnegative().default(0),
  portfolio: z.object({
    accounts: z.array(FinanceAccountSchema),
    quality: FinanceQualitySchema,
  }),
  reports: z.array(FinanceReportSchema),
  runs: z.array(FinanceRunSchema),
  health: z.object({
    schedulerOwner: z.literal("financial-engine"),
    moneyStorage: z.string(),
    eventHighWater: z.number().int().nonnegative(),
    status: z.enum(["ok", "degraded"]).optional(),
    precisionAudit: z.enum(["passed", "pending", "failed"]).optional(),
    warnings: z.array(z.string()).optional(),
    eventSync: z
      .object({
        status: z.enum(["pending", "ready", "unavailable", "recovery_required"]),
        cursor: z.number().int().nonnegative(),
        lag: z.number().int().nonnegative(),
        updatedAt: IsoDate.nullable(),
      })
      .optional(),
  }),
});

/** Unavailable service and an empty account are distinct user-visible states. */
export const FinanceOverviewSchema = z
  .object({
    availability: z.enum(["ready", "unconfigured", "unbound", "unavailable"]),
    message: z.string().nullable(),
    data: FinanceWorkspaceOverviewSchema.nullable(),
  })
  .superRefine((value, context) => {
    if ((value.availability === "ready") !== (value.data !== null)) {
      context.addIssue({
        code: "custom",
        message: "Only a ready overview contains financial data",
      });
    }
  });

export const FinanceNotificationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  body: z.string(),
  kind: z.string(),
  recordedAt: IsoDate,
  readAt: IsoDate.nullable(),
  pushStatus: z.enum([
    "pending",
    "accepted",
    "failed",
    "unavailable",
    "muted",
    "uncertain",
    "read",
    "expired",
  ]),
  pushAttempts: z.number().int().nonnegative(),
  lastPushAt: IsoDate.nullable(),
});
export const FinanceNotificationsSchema = z.object({ items: z.array(FinanceNotificationSchema) });

export const FinanceWatchlistCommandTypeSchema = z.enum(["watchlist.add", "watchlist.remove"]);
export const FinanceWatchlistCommandSchema = z
  .object({
    commandType: FinanceWatchlistCommandTypeSchema,
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/),
    expectedRevision: z.number().int().nonnegative(),
    symbol: z.string().trim().min(1).max(64),
    market: z.enum(["cn", "crypto"]),
    name: z.string().trim().min(1).max(120).optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

export const FinanceWatchlistCommandResultSchema = z.object({
  id: z.string().min(1).max(200),
  commandType: FinanceWatchlistCommandTypeSchema,
  idempotencyKey: z.string().min(8).max(128),
  status: z.literal("applied"),
  result: z.object({
    revision: z.number().int().nonnegative(),
    watchlist: z.array(FinanceAssetSchema),
  }),
});

export type FinanceAsset = z.infer<typeof FinanceAssetSchema>;
export type FinanceAccount = z.infer<typeof FinanceAccountSchema>;
export type FinanceReport = z.infer<typeof FinanceReportSchema>;
export type FinanceRun = z.infer<typeof FinanceRunSchema>;
export type FinanceRunDetail = z.infer<typeof FinanceRunDetailSchema>;
export type FinanceOverview = z.infer<typeof FinanceOverviewSchema>;
export type FinanceNotification = z.infer<typeof FinanceNotificationSchema>;
export type FinanceWatchlistCommand = z.infer<typeof FinanceWatchlistCommandSchema>;
export type FinanceWatchlistCommandResult = z.infer<typeof FinanceWatchlistCommandResultSchema>;

export const FinanceSimulationRuleIdSchema = z.enum([
  "crypto_btc_hold",
  "crypto_equal_weight",
  "crypto_rotation",
  "high_volume_volatility_grid",
]);
export const FinanceSimulationCatalogSchema = z.object({
  enabled: z.boolean(),
  markets: z.array(z.enum(["cn", "crypto"])).max(2),
  rules: z
    .array(
      z.object({
        id: FinanceSimulationRuleIdSchema,
        name: z.string().min(1).max(200),
        market: z.enum(["cn", "crypto"]),
        available: z.boolean(),
        reason: z.string().max(2000).nullable(),
      }),
    )
    .max(20),
});
export const FinanceSimulationCommandTypeSchema = z.enum([
  "simulation.create",
  "simulation.start",
  "simulation.pause",
  "simulation.resume",
  "simulation.stop",
  "simulation.run",
]);
const simulationKey = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);
const simulationFee = FinanceDecimalSchema.max(80).refine(
  (value) => simulationAmountInRange(value, "0.05", true),
  "Simulation fee must be between 0 and 0.05",
);
const simulationDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Provide a valid calendar date");
export const FinanceSimulationCreateSchema = z
  .object({
    commandType: z.literal("simulation.create"),
    idempotencyKey: simulationKey,
    name: z.string().trim().min(1).max(100),
    market: z.enum(["cn", "crypto"]),
    mode: z.enum(["paper", "backtest"]),
    symbols: z.array(z.string().trim().min(1).max(64)).min(1).max(12),
    ruleId: FinanceSimulationRuleIdSchema,
    initialCash: FinanceDecimalSchema.max(80).refine((value) =>
      simulationAmountInRange(value, "1000000000", false),
    ),
    commissionRate: simulationFee.default("0.001"),
    slippageRate: simulationFee.default("0.0005"),
    sellTaxRate: simulationFee.default("0"),
    startDate: simulationDate.nullable().optional(),
    endDate: simulationDate.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const symbolPattern = value.market === "cn" ? /^\d{6}$/ : /^[A-Z0-9]{2,16}USDT$/;
    value.symbols.forEach((symbol, index) => {
      if (!symbolPattern.test(symbol))
        context.addIssue({
          code: "custom",
          path: ["symbols", index],
          message: "Use a six-digit A-share code or an uppercase USDT spot pair",
        });
    });
    if ((value.market === "cn") !== (value.ruleId === "high_volume_volatility_grid"))
      context.addIssue({
        code: "custom",
        path: ["ruleId"],
        message: "Rule must match the selected market",
      });
    if (value.ruleId === "crypto_btc_hold" && !value.symbols.includes("BTCUSDT"))
      context.addIssue({ code: "custom", path: ["symbols"], message: "BTC hold requires BTCUSDT" });
    if (value.mode === "backtest" && (!value.startDate || !value.endDate))
      context.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Backtest requires start and end dates",
      });
    const decimals = value.initialCash.split(".")[1]?.length ?? 0;
    if (decimals > (value.market === "cn" ? 2 : 8))
      context.addIssue({
        code: "custom",
        path: ["initialCash"],
        message: "Initial cash exceeds market precision",
      });
    if (value.market === "crypto" && !simulationAmountInRange(value.sellTaxRate, "0", true))
      context.addIssue({
        code: "custom",
        path: ["sellTaxRate"],
        message: "Crypto simulation has no sell tax",
      });
    if (value.startDate && value.endDate && value.startDate >= value.endDate)
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must follow start date",
      });
    if (
      value.mode === "backtest" &&
      value.startDate &&
      value.endDate &&
      (Date.parse(`${value.endDate}T00:00:00Z`) - Date.parse(`${value.startDate}T00:00:00Z`)) /
        86400000 >
        730
    )
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Backtest supports at most 730 days",
      });
  });

/** Compare bounded input values in decimal units, without rounding to binary floats. */
function simulationAmountInRange(value: string, maximum: string, allowZero: boolean) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match || value.length > 80) return false;
  const [whole, fraction = ""] = maximum.split(".");
  const places = Math.max(fraction.length, match[3]?.length ?? 0);
  const amount = BigInt(match[2] + (match[3] ?? "").padEnd(places, "0"));
  if ((match[1] === "-" && amount !== 0n) || (!allowZero && amount === 0n)) return false;
  const limit = BigInt(whole + fraction.padEnd(places, "0"));
  return amount <= limit;
}
export const FinanceSimulationControlSchema = z
  .object({
    commandType: z.enum([
      "simulation.start",
      "simulation.pause",
      "simulation.resume",
      "simulation.stop",
      "simulation.run",
    ]),
    idempotencyKey: simulationKey,
    runId: z.number().int().positive(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export const FinanceSimulationCommandSchema = z.discriminatedUnion("commandType", [
  FinanceSimulationCreateSchema,
  FinanceSimulationControlSchema,
]);
export const FinanceSimulationCommandResultSchema = z.object({
  id: z.string().min(1).max(200),
  commandType: FinanceSimulationCommandTypeSchema,
  idempotencyKey: simulationKey,
  status: z.literal("applied"),
  result: z.object({
    runId: z.number().int().positive(),
    status: z.string().max(100),
    revision: z.number().int().nonnegative(),
    ledgerPrecision: z.literal("decimal_v1"),
  }),
});
export type FinanceSimulationCatalog = z.infer<typeof FinanceSimulationCatalogSchema>;
export type FinanceSimulationCommand = z.infer<typeof FinanceSimulationCommandSchema>;
export type FinanceSimulationCommandResult = z.infer<typeof FinanceSimulationCommandResultSchema>;
export type FinanceWorkspaceOverview = z.infer<typeof FinanceWorkspaceOverviewSchema>;
