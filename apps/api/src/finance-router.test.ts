import type { Actor } from "@marketbot/contracts";
import { createRouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  userId: "user-a",
  spaceId: "space-a",
  email: "user-a@example.test",
  isDeploymentOwner: false,
};
function setup() {
  const connect = vi.fn(async () => ({ status: "ready" }));
  const overview = vi.fn(async () => ({
    availability: "unbound",
    message: "尚未绑定",
    data: null,
  }));
  const findMany = vi.fn(async () => []);
  const updateMany = vi.fn(async () => ({ count: 0 }));
  const runInputs = vi.fn(async () => ({
    runId: 1,
    recordId: 2,
    tradingDate: "2026-10-10",
    benchmarkClose: null,
    sources: {},
    bars: {},
  }));
  const portfolioPreview = vi.fn(async () => ({
    accountId: 1,
    revision: 0,
    previewHash: "a".repeat(64),
    canCommit: true,
    insertCount: 1,
    duplicateCount: 0,
    rows: [],
    warnings: [],
  }));
  const portfolioCommand = vi.fn(async () => ({
    id: "portfolio-command",
    commandType: "portfolio.account.create",
    idempotencyKey: "create-account-1",
    status: "applied",
    result: {
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
    },
  }));
  const deps = {
    prisma: { financeNotification: { findMany, updateMany } },
    financialBridge: { overview, connect, runInputs, portfolioPreview, portfolioCommand },
    dataDir: "/tmp/financial-assistant-test",
    env: {
      agentRuntime: "scripted",
      defaultProvider: "fake",
      defaultModel: "fake",
      sandboxProvider: "fake",
      screenProxySecret: "test",
      webOrigin: "http://127.0.0.1",
    },
  } as unknown as RouterDeps;
  return {
    deps,
    connect,
    overview,
    findMany,
    updateMany,
    runInputs,
    portfolioPreview,
    portfolioCommand,
    router: createRouter(deps),
  };
}

describe("financial RPC authorization", () => {
  it("requires login for portfolio writes and uses only the authenticated subject", async () => {
    const { router, portfolioCommand } = setup();
    const command = {
      commandType: "portfolio.account.create" as const,
      idempotencyKey: "create-account-1",
      name: "Manual",
      market: "crypto" as const,
      currency: "USDT" as const,
    };
    const anonymous = createRouterClient(router, { context: { actor: null } });
    await expect(anonymous.finance.portfolioCommand(command)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(portfolioCommand).not.toHaveBeenCalled();
    const client = createRouterClient(router, { context: { actor } });
    await client.finance.portfolioCommand(command);
    expect(portfolioCommand).toHaveBeenCalledExactlyOnceWith(actor.userId, command);
    const handler = new RPCHandler(router);
    const { response } = await handler.handle(
      new Request("http://127.0.0.1/rpc/finance/portfolioCommand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { ...command, owner_id: "user-b" } }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    expect(response?.status).toBe(400);
    expect(portfolioCommand).toHaveBeenCalledTimes(1);
  });
  it("allows self-binding only for the authenticated deployment owner", async () => {
    const { router, connect } = setup();
    const client = createRouterClient(router, { context: { actor } });
    await expect(client.finance.connect({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(connect).not.toHaveBeenCalled();
    const owner = createRouterClient(router, {
      context: { actor: { ...actor, isDeploymentOwner: true } },
    });
    await owner.finance.connect({});
    expect(connect).toHaveBeenCalledExactlyOnceWith(actor.userId);
  });
  it("requires login before calling the financial service or reading notifications", async () => {
    const { router, overview, findMany } = setup();
    const client = createRouterClient(router, { context: { actor: null } });
    await expect(client.finance.overview({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(client.finance.notifications({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(overview).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
  it("takes identity only from the authenticated context", async () => {
    const { router, overview } = setup();
    const handler = new RPCHandler(router);
    const { response } = await handler.handle(
      new Request("http://127.0.0.1/rpc/finance/overview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          json: { userId: "user-b", workspaceId: "private-b", owner_id: "user-b" },
        }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    expect(response?.status).toBe(400);
    expect(overview).not.toHaveBeenCalled();
    const client = createRouterClient(router, { context: { actor } });
    await client.finance.overview({});
    expect(overview).toHaveBeenCalledWith("user-a");
  });
  it("scopes list and read feedback to the current user and conceals another user's ID", async () => {
    const { router, findMany, updateMany } = setup();
    const client = createRouterClient(router, { context: { actor } });
    await client.finance.notifications({});
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-a" } }));
    await expect(client.finance.markRead({ id: "other-user-notification" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "other-user-notification", userId: "user-a" } }),
    );
  });
  it("retrieves stored simulation inputs only with the authenticated subject", async () => {
    const { router, runInputs } = setup();
    const client = createRouterClient(router, { context: { actor } });
    await client.finance.runInputs({ runId: 1, recordId: 2 });
    expect(runInputs).toHaveBeenCalledExactlyOnceWith("user-a", 1, 2);
    const anonymous = createRouterClient(router, { context: { actor: null } });
    await expect(anonymous.finance.runInputs({ runId: 1, recordId: 2 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(runInputs).toHaveBeenCalledTimes(1);
  });
});
