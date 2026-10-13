import * as z from "zod";
import { FinanceDecimalSchema } from "./finance.js";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const FinanceRunInputsQuerySchema = z.object({ runId: id, recordId: id }).strict();
export const FinanceRunInputsSchema = z.object({
  runId: id,
  recordId: id,
  tradingDate: day.nullable(),
  benchmarkClose: FinanceDecimalSchema.nullable(),
  sources: z.record(z.string().max(32), z.string().max(150)),
  bars: z.record(
    z.string().max(32),
    z
      .array(
        z.object({
          tradingDate: day.nullable(),
          open: FinanceDecimalSchema.nullable(),
          close: FinanceDecimalSchema.nullable(),
          high: FinanceDecimalSchema.nullable(),
          low: FinanceDecimalSchema.nullable(),
          volume: FinanceDecimalSchema.nullable(),
          amount: FinanceDecimalSchema.nullable(),
          priceInputSource: z.string().min(1).max(150),
        }),
      )
      .max(10_000),
  ),
});
export type FinanceRunInputs = z.infer<typeof FinanceRunInputsSchema>;
