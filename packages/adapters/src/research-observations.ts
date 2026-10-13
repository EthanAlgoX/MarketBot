import { createHash } from "node:crypto";
import type {
  FinanceObservation,
  FinanceObservationInput,
  FinanceResearchRequest,
  FinanceRuleDraft,
  FinanceRuleDraftInput,
  FinanceSimulationCatalog,
} from "@marketbot/contracts";
import { FinanceRuleDraftInputSchema, FinanceRuleDraftSchema } from "@marketbot/contracts";
import type { PrismaClient } from "@marketbot/db";
import { IntelligenceError } from "./intelligence-service.js";

type Row = {
  id: string;
  requestId: string;
  idempotencyKey: string;
  note: string;
  summary: string | null;
  validUntil: Date | null;
  invalidationCondition: string | null;
  createdAt: Date;
};
const view = (row: Row): FinanceObservation => ({
  ...row,
  validUntil: row.validUntil?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});
const select = {
  id: true,
  requestId: true,
  idempotencyKey: true,
  note: true,
  summary: true,
  validUntil: true,
  invalidationCondition: true,
  createdAt: true,
} as const;

/** Saves a user's observation and an immutable research reference; starts no task. */
export class ResearchObservations {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly request: (userId: string, id: string) => Promise<FinanceResearchRequest>,
  ) {}
  async list(userId: string): Promise<FinanceObservation[]> {
    return (
      await this.prisma.researchObservation.findMany({
        where: { userId },
        select,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      })
    ).map(view);
  }
  async save(userId: string, input: FinanceObservationInput): Promise<FinanceObservation> {
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          requestId: input.requestId,
          note: input.note,
          validUntil: input.validUntil ? new Date(input.validUntil).toISOString() : null,
          ...(input.invalidationCondition
            ? { invalidationCondition: input.invalidationCondition }
            : {}),
        }),
      )
      .digest("hex");
    const prior = await this.prisma.researchObservation.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
    });
    if (prior) {
      if (prior.requestHash !== requestHash)
        throw new IntelligenceError("CONFLICT", "观察操作编号已用于其他内容");
      return view({
        id: prior.id,
        requestId: prior.requestId,
        idempotencyKey: prior.idempotencyKey,
        note: prior.note,
        summary: prior.summary,
        validUntil: prior.validUntil,
        invalidationCondition: prior.invalidationCondition,
        createdAt: prior.createdAt,
      });
    }
    if (input.validUntil && new Date(input.validUntil).getTime() <= Date.now())
      throw new IntelligenceError("BAD_REQUEST", "观察期限应晚于当前时间");
    const task = await this.request(userId, input.requestId);
    if (task.status !== "succeeded" || !task.result || !task.resultRef)
      throw new IntelligenceError("BAD_REQUEST", "请从已完成的真实研究保存观察");
    const report = task.result.report;
    const summaryObject =
      report && typeof report === "object" && !Array.isArray(report) ? report.summary : null;
    const text =
      summaryObject && typeof summaryObject === "object" && !Array.isArray(summaryObject)
        ? summaryObject.analysis_summary
        : null;
    const summary = typeof text === "string" ? text.slice(0, 5000) : null;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`observation:${userId}`}, 0))::text`;
      const existing = await tx.researchObservation.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new IntelligenceError("CONFLICT", "观察操作编号已用于其他内容");
        return view({
          id: existing.id,
          requestId: existing.requestId,
          idempotencyKey: existing.idempotencyKey,
          note: existing.note,
          summary: existing.summary,
          validUntil: existing.validUntil,
          invalidationCondition: existing.invalidationCondition,
          createdAt: existing.createdAt,
        });
      }
      return view(
        await tx.researchObservation.create({
          data: {
            userId,
            ...input,
            requestHash,
            summary,
            snapshot: {
              request: task.request,
              resultRef: task.resultRef,
              result: task.result,
              createdAt: task.createdAt,
            },
          },
          select,
        }),
      );
    });
  }
}

/** Canonical hashes are independent of JSONB object key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([name, item]) => `${JSON.stringify(name)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
type DraftRow = {
  id: string;
  observationId: string;
  requestId: string;
  idempotencyKey: string;
  configuration: unknown;
  rule: unknown;
  researchSnapshot: unknown;
  researchSnapshotDigest: string;
  createdAt: Date;
};
function draftView(row: DraftRow): FinanceRuleDraft {
  return FinanceRuleDraftSchema.parse({
    ...row,
    status: "draft",
    versionBinding: "on_simulation_create",
    createdAt: row.createdAt.toISOString(),
  });
}

/** Persists an explicit user-authored configuration; never issues an engine command. */
export class ResearchRuleDrafts {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly available: (
      userId: string,
    ) => Promise<{ catalog: FinanceSimulationCatalog; supportedCommands: string[] }>,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async list(userId: string): Promise<FinanceRuleDraft[]> {
    return (
      await this.prisma.researchRuleDraft.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      })
    ).map(draftView);
  }
  async status(userId: string, idempotencyKey: string): Promise<FinanceRuleDraft | null> {
    const row = await this.prisma.researchRuleDraft.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    return row ? draftView(row) : null;
  }
  async save(userId: string, raw: FinanceRuleDraftInput): Promise<FinanceRuleDraft> {
    const checked = FinanceRuleDraftInputSchema.safeParse(raw);
    if (!checked.success) throw new IntelligenceError("BAD_REQUEST", "规则配置未通过模拟输入校验");
    const input = checked.data;
    const requestHash = digest({
      observationId: input.observationId,
      configuration: input.configuration,
    });
    const prior = await this.prisma.researchRuleDraft.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
    });
    if (prior) {
      if (prior.requestHash !== requestHash)
        throw new IntelligenceError("CONFLICT", "草稿操作编号已用于其他内容");
      return draftView(prior);
    }
    // Check ownership before consulting the financial service. Missing and foreign are identical.
    const observation = await this.prisma.researchObservation.findFirst({
      where: { id: input.observationId, userId },
    });
    if (!observation) throw new IntelligenceError("NOT_FOUND", "观察记录不存在");
    validateRuleDraftMarketDate(input.configuration, this.now());
    const { catalog, supportedCommands } = await this.available(userId);
    const rule = catalog.rules.find(
      (item) =>
        item.id === input.configuration.ruleId && item.market === input.configuration.market,
    );
    if (
      !catalog.enabled ||
      !catalog.markets.includes(input.configuration.market) ||
      !supportedCommands.includes("simulation.create") ||
      !rule?.available
    )
      throw new IntelligenceError("FORBIDDEN", "所选规则尚未开放，草稿未保存");
    const researchSnapshot = FinanceRuleDraftSchema.shape.researchSnapshot.parse(
      observation.snapshot,
    );
    const researchSnapshotDigest = digest(researchSnapshot);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rule-draft:${userId}`}, 0))::text`;
      const existing = await tx.researchRuleDraft.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new IntelligenceError("CONFLICT", "草稿操作编号已用于其他内容");
        return draftView(existing);
      }
      return draftView(
        await tx.researchRuleDraft.create({
          data: {
            userId,
            observationId: observation.id,
            requestId: observation.requestId,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            configuration: input.configuration,
            rule: { id: rule.id, name: rule.name, market: rule.market },
            researchSnapshot,
            researchSnapshotDigest,
          },
        }),
      );
    });
  }
}

/** New drafts use closed market dates. Existing receipts remain immutable and recoverable. */
export function validateRuleDraftMarketDate(
  configuration: FinanceRuleDraftInput["configuration"],
  now: Date,
) {
  if (configuration.mode !== "backtest") return;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: configuration.market === "cn" ? "Asia/Shanghai" : "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  if (
    !configuration.startDate ||
    !configuration.endDate ||
    configuration.startDate >= configuration.endDate ||
    configuration.endDate >= today
  )
    throw new IntelligenceError(
      "BAD_REQUEST",
      "回测必须填写已收盘的过去日期，结束日应晚于开始日且早于市场今天",
    );
}
