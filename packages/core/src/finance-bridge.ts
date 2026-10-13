import type {
  FinanceEventPage,
  FinanceOverview,
  FinancePortfolioAccountDetail,
  FinancePortfolioAccounts,
  FinancePortfolioCommand,
  FinancePortfolioCommandResult,
  FinancePortfolioPreview,
  FinancePortfolioPreviewInput,
  FinanceResearchCommand,
  FinanceResearchOverview,
  FinanceResearchRequest,
  FinanceRunDetail,
  FinanceRunInputs,
  FinanceSimulationCatalog,
  FinanceSimulationCommand,
  FinanceSimulationCommandResult,
  FinanceWatchlistCommand,
  FinanceWatchlistCommandResult,
} from "@marketbot/contracts";
import {
  FinanceEventPageSchema,
  FinancePortfolioAccountDetailSchema,
  FinancePortfolioAccountsSchema,
  FinancePortfolioCommandResultSchema,
  FinancePortfolioPreviewSchema,
  FinanceResearchOverviewSchema,
  FinanceResearchRequestSchema,
  FinanceRunDetailSchema,
  FinanceRunInputsSchema,
  FinanceSimulationCatalogSchema,
  FinanceSimulationCommandResultSchema,
  FinanceWatchlistCommandResultSchema,
  FinanceWorkspaceOverviewSchema,
} from "@marketbot/contracts";

export interface FinanceBridgeConfig {
  url: string;
  token: string;
  issuer: string;
}

/** Configured only by the deployment; no client can select a service or workspace. */
export function resolveFinanceBridgeConfig(
  source: Record<string, string | undefined>,
): FinanceBridgeConfig | undefined {
  const url = source.FINANCIAL_BRIDGE_URL?.trim();
  const token = source.FINANCIAL_BRIDGE_TOKEN?.trim();
  const issuer = source.FINANCIAL_BRIDGE_ISSUER?.trim();
  if (![url, token, issuer].some(Boolean)) return undefined;
  if (!url || !token || !issuer) throw new Error("Configure all three FINANCIAL_BRIDGE settings");
  if (token.length < 32)
    throw new Error("FINANCIAL_BRIDGE_TOKEN must contain at least 32 characters");
  const parsed = new URL(url);
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !["", "/"].includes(parsed.pathname)
  )
    throw new Error("FINANCIAL_BRIDGE_URL must be an HTTPS origin or local HTTP origin");
  return { url: parsed.origin, token, issuer };
}

export class FinanceBridgeError extends Error {
  constructor(
    readonly code:
      | "unbound"
      | "unavailable"
      | "recovery_required"
      | "not_found"
      | "conflict"
      | "bad_request"
      | "rate_limited",
  ) {
    super(code);
  }
}

export class FinanceBridgeClient {
  constructor(
    private readonly config: FinanceBridgeConfig,
    private readonly http: typeof fetch = fetch,
  ) {}

  private async get(subject: string, path: string, body?: object): Promise<unknown> {
    try {
      const response = await this.http(`${this.config.url}/internal/assistant/v1/${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "X-Assistant-Issuer": this.config.issuer,
          "X-Assistant-Subject": subject,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status === 403) throw new FinanceBridgeError("unbound");
      if (response.status === 404) throw new FinanceBridgeError("not_found");
      if (response.status === 409)
        throw new FinanceBridgeError(path.startsWith("events?") ? "recovery_required" : "conflict");
      if ([400, 413, 422].includes(response.status)) throw new FinanceBridgeError("bad_request");
      if (response.status === 429) throw new FinanceBridgeError("rate_limited");
      if (!response.ok) throw new FinanceBridgeError("unavailable");
      // Do not surface upstream response/error text: it may include private details.
      return await response.json();
    } catch (error) {
      if (error instanceof FinanceBridgeError) throw error;
      throw new FinanceBridgeError("unavailable");
    }
  }

  async overview(subject: string): Promise<FinanceOverview> {
    try {
      const data = FinanceWorkspaceOverviewSchema.parse(await this.get(subject, "overview"));
      return { availability: "ready", message: null, data };
    } catch (error) {
      const unbound = error instanceof FinanceBridgeError && error.code === "unbound";
      return {
        availability: unbound ? "unbound" : "unavailable",
        message: unbound ? "此账号尚未绑定金融工作区" : "金融服务暂时不可用，请稍后重试",
        data: null,
      };
    }
  }

  /** A missing receipt permits an explicit retry under its original key. */
  private async findCommand(subject: string, commandType: string, idempotencyKey: string) {
    try {
      return await this.get(
        subject,
        `commands/${encodeURIComponent(idempotencyKey)}?commandType=${encodeURIComponent(commandType)}`,
      );
    } catch (error) {
      if (error instanceof FinanceBridgeError && error.code === "not_found") return null;
      throw error;
    }
  }

  async connect(subject: string): Promise<{ status: "ready" }> {
    const result = await this.get(subject, "bindings/self", {});
    if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ready")
      throw new FinanceBridgeError("unavailable");
    return { status: "ready" };
  }

  async events(subject: string, after: number): Promise<FinanceEventPage> {
    if (!Number.isSafeInteger(after) || after < 0) throw new Error("Invalid event cursor");
    const raw = await this.get(subject, `events?after=${after}&limit=100`);
    const parsed = FinanceEventPageSchema.safeParse(raw);
    if (!parsed.success || parsed.data.after !== after) throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async run(subject: string, id: number): Promise<FinanceRunDetail> {
    if (!Number.isSafeInteger(id) || id < 0) throw new Error("Invalid financial run ID");
    const parsed = FinanceRunDetailSchema.safeParse(await this.get(subject, `runs/${id}`));
    if (!parsed.success || parsed.data.id !== id) throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async runInputs(subject: string, runId: number, recordId: number): Promise<FinanceRunInputs> {
    if (![runId, recordId].every((value) => Number.isSafeInteger(value) && value > 0))
      throw new Error("Invalid financial input reference");
    const parsed = FinanceRunInputsSchema.safeParse(
      await this.get(subject, `runs/${runId}/days/${recordId}/inputs`),
    );
    if (!parsed.success || parsed.data.runId !== runId || parsed.data.recordId !== recordId)
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async watchlistCommand(
    subject: string,
    command: FinanceWatchlistCommand,
  ): Promise<FinanceWatchlistCommandResult> {
    const { commandType, ...input } = command;
    const parsed = FinanceWatchlistCommandResultSchema.safeParse(
      await this.get(subject, `commands/${commandType}`, input),
    );
    if (
      !parsed.success ||
      parsed.data.commandType !== commandType ||
      parsed.data.idempotencyKey !== input.idempotencyKey
    )
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async portfolioAccounts(subject: string): Promise<FinancePortfolioAccounts> {
    const parsed = FinancePortfolioAccountsSchema.safeParse(
      await this.get(subject, "portfolio/accounts"),
    );
    if (!parsed.success) throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async portfolioAccount(
    subject: string,
    accountId: number,
  ): Promise<FinancePortfolioAccountDetail> {
    if (!Number.isSafeInteger(accountId) || accountId <= 0) throw new Error("Invalid account ID");
    const parsed = FinancePortfolioAccountDetailSchema.safeParse(
      await this.get(subject, `portfolio/accounts/${accountId}`),
    );
    if (!parsed.success || parsed.data.account.id !== accountId)
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async portfolioPreview(
    subject: string,
    input: FinancePortfolioPreviewInput,
  ): Promise<FinancePortfolioPreview> {
    const parsed = FinancePortfolioPreviewSchema.safeParse(
      await this.get(subject, "portfolio/import/preview", input),
    );
    if (
      !parsed.success ||
      parsed.data.accountId !== input.accountId ||
      parsed.data.revision !== input.expectedRevision ||
      parsed.data.rows.length !== input.records.length ||
      parsed.data.rows.some((row, index) => row.index !== index)
    )
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async portfolioCommand(
    subject: string,
    command: FinancePortfolioCommand,
  ): Promise<FinancePortfolioCommandResult> {
    const { commandType, ...input } = command;
    const parsed = FinancePortfolioCommandResultSchema.safeParse(
      await this.get(subject, `commands/${commandType}`, input),
    );
    if (
      !parsed.success ||
      parsed.data.commandType !== commandType ||
      parsed.data.idempotencyKey !== input.idempotencyKey ||
      ("accountId" in input &&
        "accountId" in parsed.data.result &&
        parsed.data.result.accountId !== input.accountId) ||
      (command.commandType === "portfolio.account.create" &&
        parsed.data.commandType === "portfolio.account.create" &&
        (parsed.data.result.account.name !== command.name ||
          parsed.data.result.account.market !== command.market ||
          parsed.data.result.account.currency !== command.currency)) ||
      (parsed.data.commandType === "portfolio.trades.import" &&
        parsed.data.result.tradeIds.length !== parsed.data.result.insertedCount)
    )
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async portfolioCommandStatus(
    subject: string,
    commandType: FinancePortfolioCommand["commandType"],
    idempotencyKey: string,
  ): Promise<FinancePortfolioCommandResult | null> {
    const raw = await this.findCommand(subject, commandType, idempotencyKey);
    if (raw === null) return null;
    const parsed = FinancePortfolioCommandResultSchema.safeParse(raw);
    if (
      !parsed.success ||
      parsed.data.commandType !== commandType ||
      parsed.data.idempotencyKey !== idempotencyKey
    )
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async commandStatus(
    subject: string,
    commandType: FinanceWatchlistCommand["commandType"],
    idempotencyKey: string,
  ): Promise<FinanceWatchlistCommandResult | null> {
    const result = await this.findCommand(subject, commandType, idempotencyKey);
    if (result === null) return null;
    const parsed = FinanceWatchlistCommandResultSchema.safeParse(result);
    if (
      !parsed.success ||
      parsed.data.commandType !== commandType ||
      parsed.data.idempotencyKey !== idempotencyKey
    )
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async simulationCatalog(subject: string): Promise<FinanceSimulationCatalog> {
    const parsed = FinanceSimulationCatalogSchema.safeParse(
      await this.get(subject, "simulation/catalog"),
    );
    if (!parsed.success) throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async simulationCommand(
    subject: string,
    command: FinanceSimulationCommand,
  ): Promise<FinanceSimulationCommandResult> {
    const { commandType, ...input } = command;
    const parsed = FinanceSimulationCommandResultSchema.safeParse(
      await this.get(subject, `commands/${commandType}`, input),
    );
    if (
      !parsed.success ||
      parsed.data.commandType !== commandType ||
      parsed.data.idempotencyKey !== input.idempotencyKey
    )
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async simulationCommandStatus(
    subject: string,
    commandType: FinanceSimulationCommand["commandType"],
    idempotencyKey: string,
  ): Promise<FinanceSimulationCommandResult | null> {
    const result = await this.findCommand(subject, commandType, idempotencyKey);
    if (result === null) return null;
    const parsed = FinanceSimulationCommandResultSchema.safeParse(result);
    if (
      !parsed.success ||
      parsed.data.commandType !== commandType ||
      parsed.data.idempotencyKey !== idempotencyKey
    )
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async researchOverview(subject: string): Promise<FinanceResearchOverview> {
    const [capabilities, usage, requests] = await Promise.all([
      this.get(subject, "research/capabilities"),
      this.get(subject, "research/usage"),
      this.get(subject, "research/requests?limit=50"),
    ]);
    const parsed = FinanceResearchOverviewSchema.safeParse({ capabilities, usage, requests });
    if (!parsed.success) throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async researchRequest(subject: string, id: string): Promise<FinanceResearchRequest> {
    const parsed = FinanceResearchRequestSchema.safeParse(
      await this.get(subject, `research/requests/${encodeURIComponent(id)}`),
    );
    if (!parsed.success || parsed.data.id !== id) throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async researchCommand(
    subject: string,
    command: FinanceResearchCommand,
  ): Promise<FinanceResearchRequest> {
    const { commandType, ...input } = command;
    const parsed = FinanceResearchRequestSchema.safeParse(
      await this.get(subject, `commands/${commandType}`, input),
    );
    if (
      !parsed.success ||
      parsed.data.commandType !== commandType ||
      parsed.data.idempotencyKey !== input.idempotencyKey
    )
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }

  async researchCommandStatus(
    subject: string,
    commandType: FinanceResearchCommand["commandType"],
    idempotencyKey: string,
  ): Promise<FinanceResearchRequest | null> {
    const result = await this.findCommand(subject, commandType, idempotencyKey);
    if (result === null) return null;
    const parsed = FinanceResearchRequestSchema.safeParse(result);
    if (
      !parsed.success ||
      parsed.data.commandType !== commandType ||
      parsed.data.idempotencyKey !== idempotencyKey
    )
      throw new FinanceBridgeError("unavailable");
    return parsed.data;
  }
}

export const unconfiguredFinanceOverview: FinanceOverview = {
  availability: "unconfigured",
  message: "尚未连接金融服务",
  data: null,
};
