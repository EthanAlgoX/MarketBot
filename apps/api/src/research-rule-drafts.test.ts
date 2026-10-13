import type { Actor } from "@marketbot/contracts";
import { createRouterClient, ORPCError } from "@orpc/server";
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
const input = {
  observationId: "owned-observation",
  idempotencyKey: "rule-draft-intent",
  configuration: {
    name: "User rule",
    market: "crypto" as const,
    mode: "paper" as const,
    ruleId: "crypto_btc_hold" as const,
    symbols: ["BTCUSDT"],
    initialCash: "1000",
  },
};
function setup() {
  const observation = vi.fn(async () => null);
  const prior = vi.fn(async () => null);
  const list = vi.fn(async () => []);
  const catalog = vi.fn(async () => {
    throw new ORPCError("FORBIDDEN");
  });
  const deps = {
    prisma: {
      researchObservation: { findFirst: observation },
      researchRuleDraft: { findUnique: prior, findMany: list },
    },
    financialBridge: {
      overview: async () => ({ availability: "unbound", data: null, message: null }),
      simulationCatalog: catalog,
    },
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
  return { router: createRouter(deps), observation, prior, list, catalog };
}
describe("saved research rule draft RPC authority", () => {
  it("requires authentication for draft saves and reads before touching storage", async () => {
    const { router, prior, list } = setup();
    const client = createRouterClient(router, { context: { actor: null } });
    await expect(client.finance.saveRuleDraft(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(client.finance.ruleDrafts({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      client.finance.ruleDraftStatus({ idempotencyKey: input.idempotencyKey }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(prior).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
  it("uses authenticated ownership and conceals a foreign observation", async () => {
    const { router, observation, catalog } = setup();
    const client = createRouterClient(router, { context: { actor } });
    await expect(client.finance.saveRuleDraft(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(observation).toHaveBeenCalledExactlyOnceWith({
      where: { id: input.observationId, userId: actor.userId },
    });
    expect(catalog).not.toHaveBeenCalled();
    const { response } = await new RPCHandler(router).handle(
      new Request("http://127.0.0.1/rpc/finance/saveRuleDraft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { ...input, userId: "user-b" } }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    expect(response?.status).toBe(400);
    expect(observation).toHaveBeenCalledTimes(1);
  });
  it("preserves an upstream ORPC gate error rather than replacing it with a generic failure", async () => {
    const { router, observation } = setup();
    observation.mockResolvedValue({ id: input.observationId } as never);
    const client = createRouterClient(router, { context: { actor } });
    await expect(client.finance.saveRuleDraft(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
