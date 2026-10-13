import * as z from "zod";
import { FinanceDecimalSchema } from "./finance.js";
import { IsoDate } from "./ids.js";

const sequence = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const envelope = {
  id: z.string().min(1),
  sequence: sequence.min(1),
  recordedAt: IsoDate,
};
const tradingDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const FinanceEventSchema = z.discriminatedUnion("kind", [
  z.object({
    ...envelope,
    kind: z.literal("integration.test"),
    simulationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    executionPrecision: z.literal("day").nullable(),
    payload: z.record(z.string(), z.json()),
  }),
  z.object({
    ...envelope,
    kind: z.literal("simulation.day"),
    simulationDate: tradingDate,
    executionPrecision: z.literal("day"),
    payload: z.object({
      runId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      recordId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
      name: z.string().max(200),
      status: z.string().max(100),
      ledgerPrecision: z.literal("decimal_v1"),
      cash: FinanceDecimalSchema,
      equity: FinanceDecimalSchema,
      currency: z.string().min(1).max(20),
      trades: z
        .array(
          z.object({
            symbol: z.string().min(1).max(100),
            orderId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
            fillId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
            side: z.enum(["buy", "sell"]),
            status: z.enum(["filled", "rejected"]),
            quantity: FinanceDecimalSchema,
            price: FinanceDecimalSchema.nullable(),
            fee: FinanceDecimalSchema,
            slippage: FinanceDecimalSchema,
            signalDate: tradingDate.nullable(),
            reason: z.string().max(2000),
          }),
        )
        .max(500),
    }),
  }),
]);

export const FinanceEventPageSchema = z.object({
  streamId: z.string().min(1),
  highWater: sequence,
  after: sequence,
  events: z.array(FinanceEventSchema).max(100),
});

export type FinanceEvent = z.infer<typeof FinanceEventSchema>;
export type FinanceEventPage = z.infer<typeof FinanceEventPageSchema>;
