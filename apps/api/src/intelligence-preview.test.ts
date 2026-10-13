import type { Actor } from "@marketbot/contracts";
import { createRouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const actor: Actor = {
  userId: "preview-owner",
  spaceId: "space",
  email: "reader@example.test",
  isDeploymentOwner: false,
};
function setup() {
  const sources = vi.fn(async () => []);
  const contents = vi.fn(async () => []);
  const deps = {
    prisma: {
      intelligenceSource: { findMany: sources },
      intelligenceContent: { findMany: contents },
    },
    dataDir: "/tmp/financial-assistant-preview-test",
    env: {
      agentRuntime: "scripted",
      defaultProvider: "fake",
      defaultModel: "fake",
      sandboxProvider: "fake",
      screenProxySecret: "test",
      webOrigin: "http://127.0.0.1",
    },
  } as unknown as RouterDeps;
  return { router: createRouter(deps), sources, contents };
}
const input = { sourceId: null, includeTerms: ["BTC"], excludeTerms: [] };
describe("authenticated subscription preview RPC", () => {
  it("requires login before sampling any content", async () => {
    const { router, sources, contents } = setup();
    const client = createRouterClient(router, { context: { actor: null } });
    await expect(client.intelligence.previewSubscription(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(sources).not.toHaveBeenCalled();
    expect(contents).not.toHaveBeenCalled();
  });
  it("derives the user from authentication and reports uncollected coverage", async () => {
    const { router, sources, contents } = setup();
    const client = createRouterClient(router, { context: { actor } });
    const result = await client.intelligence.previewSubscription(input);
    expect(sources).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: actor.userId } }),
    );
    expect(contents).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceId: { in: [] }, source: { userId: actor.userId } },
      }),
    );
    expect(result.coverage).toMatchObject({ status: "unavailable", sampleCount: 0 });
    const handler = new RPCHandler(router);
    const { response } = await handler.handle(
      new Request("http://localhost/rpc/intelligence/previewSubscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { ...input, userId: "foreign", enabled: true } }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    expect(response?.status).toBe(400);
    expect(sources).toHaveBeenCalledTimes(1);
  });
});
