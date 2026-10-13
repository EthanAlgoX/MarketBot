import * as z from "zod";
import { FinanceSimulationCreateSchema, FinanceSimulationRuleIdSchema } from "./finance.js";
import { IsoDate } from "./ids.js";

const key = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const code = z.string().min(1).max(100);
export const FinanceResearchCommandTypeSchema = z.enum(["research.create", "screening.create"]);
export const FinanceResearchCommandSchema = z.discriminatedUnion("commandType", [
  z
    .object({
      commandType: z.literal("research.create"),
      idempotencyKey: key,
      market: z.enum(["cn", "crypto"]),
      symbol: z.string().trim().min(1).max(32),
      reportType: z.enum(["simple", "detailed"]).default("detailed"),
    })
    .strict(),
  z
    .object({
      commandType: z.literal("screening.create"),
      idempotencyKey: key,
      market: z.enum(["cn", "crypto"]),
      strategy: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
      maxResults: z.number().int().min(1).max(30).default(10),
    })
    .strict(),
]);
export const FinanceResearchCapabilitiesSchema = z.object({
  enabled: z.boolean(),
  reason: code.nullable(),
  missingDependencies: z.array(z.string().max(100)).max(30),
  requestTokenLimit: count,
  dailyTokenLimit: count,
  maxOutputTokens: count,
  maxActiveRequests: count,
  maxSourceCalls: count,
  requestTimeoutSeconds: count,
  sourceTimeoutSeconds: count,
  sourceCallUnit: z.literal("provider_operation"),
  cost: z.null(),
  currency: z.null(),
  liveTrading: z.literal(false),
});
export const FinanceResearchUsageSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.literal("UTC"),
  tokenLimit: count,
  committedTokens: count,
  verifiedTokens: count,
  unverifiedReservedTokens: count,
  remainingTokens: count,
  blocked: z.boolean(),
  reason: code.nullable(),
  modelCalls: count,
  cost: z.null(),
  currency: z.null(),
});
export const FinanceResearchRequestSchema = z.object({
  id: z.string().min(1).max(200),
  commandType: FinanceResearchCommandTypeSchema,
  idempotencyKey: key,
  status: z.enum(["queued", "running", "succeeded", "failed", "interrupted"]),
  request: z.record(z.string(), z.json()),
  resultRef: z.record(z.string(), z.json()).nullable(),
  result: z.record(z.string(), z.json()).nullable(),
  error: z.object({ code }).nullable(),
  createdAt: IsoDate,
  startedAt: IsoDate.nullable(),
  completedAt: IsoDate.nullable(),
  modelOutputs: z
    .array(
      z.object({
        callId: z.string().min(1).max(200),
        model: z.string().max(128),
        status: z.string().max(30),
        output: z.object({ content: z.string().max(100_000), truncated: z.boolean() }),
      }),
    )
    .max(100),
  cost: z.null(),
  currency: z.null(),
});
export const FinanceResearchOverviewSchema = z.object({
  capabilities: FinanceResearchCapabilitiesSchema,
  usage: FinanceResearchUsageSchema,
  requests: z.array(FinanceResearchRequestSchema).max(50),
});
export type FinanceResearchCommand = z.infer<typeof FinanceResearchCommandSchema>;
export type FinanceResearchRequest = z.infer<typeof FinanceResearchRequestSchema>;
export type FinanceResearchOverview = z.infer<typeof FinanceResearchOverviewSchema>;

export const FinanceObservationInputSchema = z
  .object({
    requestId: z.string().min(1).max(200),
    idempotencyKey: key,
    note: z.string().trim().min(1).max(2000),
    validUntil: IsoDate.nullable(),
    invalidationCondition: z.string().trim().min(1).max(1000).nullable().default(null),
  })
  .strict();
export const FinanceObservationSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  idempotencyKey: key,
  note: z.string().max(2000),
  summary: z.string().max(5000).nullable(),
  validUntil: IsoDate.nullable(),
  invalidationCondition: z.string().max(1000).nullable().default(null),
  createdAt: IsoDate,
});
export type FinanceObservation = z.infer<typeof FinanceObservationSchema>;
export type FinanceObservationInput = z.infer<typeof FinanceObservationInputSchema>;

export function financeObservationMatchesInput(
  item: FinanceObservation,
  input: FinanceObservationInput,
) {
  return (
    item.idempotencyKey === input.idempotencyKey &&
    item.requestId === input.requestId &&
    item.note === input.note &&
    item.invalidationCondition === input.invalidationCondition &&
    (item.validUntil === null
      ? input.validUntil === null
      : input.validUntil !== null && Date.parse(item.validUntil) === Date.parse(input.validUntil))
  );
}

/** Drafts reuse execution input validation but carry no executable command or key. */
const simulationFields = FinanceSimulationCreateSchema.shape;
export const FinanceRuleDraftConfigurationSchema = z
  .object({
    name: simulationFields.name,
    market: simulationFields.market,
    mode: simulationFields.mode,
    symbols: simulationFields.symbols,
    ruleId: simulationFields.ruleId,
    initialCash: simulationFields.initialCash,
    commissionRate: simulationFields.commissionRate,
    slippageRate: simulationFields.slippageRate,
    sellTaxRate: simulationFields.sellTaxRate,
    startDate: simulationFields.startDate,
    endDate: simulationFields.endDate,
  })
  .strict()
  .superRefine((configuration, context) => {
    const checked = FinanceSimulationCreateSchema.safeParse({
      ...configuration,
      commandType: "simulation.create",
      idempotencyKey: "draft-validation",
    });
    if (!checked.success)
      for (const issue of checked.error.issues)
        context.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });
export const FinanceRuleDraftInputSchema = z
  .object({
    observationId: z.string().min(1).max(200),
    idempotencyKey: key,
    configuration: FinanceRuleDraftConfigurationSchema,
  })
  .strict();
export const FinanceRuleDraftSchema = z.object({
  id: z.string().min(1).max(200),
  observationId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  idempotencyKey: key,
  status: z.literal("draft"),
  configuration: FinanceRuleDraftConfigurationSchema,
  rule: z.object({
    id: FinanceSimulationRuleIdSchema,
    name: z.string().min(1).max(200),
    market: z.enum(["cn", "crypto"]),
  }),
  versionBinding: z.literal("on_simulation_create"),
  researchSnapshot: z.record(z.string(), z.json()),
  researchSnapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: IsoDate,
});
export type FinanceRuleDraftConfiguration = z.infer<typeof FinanceRuleDraftConfigurationSchema>;
export type FinanceRuleDraftInput = z.infer<typeof FinanceRuleDraftInputSchema>;
export type FinanceRuleDraft = z.infer<typeof FinanceRuleDraftSchema>;

export function financeRuleDraftMatchesInput(
  draft: FinanceRuleDraft,
  input: FinanceRuleDraftInput,
) {
  return (
    draft.idempotencyKey === input.idempotencyKey &&
    draft.observationId === input.observationId &&
    JSON.stringify(FinanceRuleDraftConfigurationSchema.parse(draft.configuration)) ===
      JSON.stringify(FinanceRuleDraftConfigurationSchema.parse(input.configuration))
  );
}
