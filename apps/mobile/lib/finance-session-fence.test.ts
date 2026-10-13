import { describe, expect, it, vi } from "vitest";
import type { ApiRequestContext } from "./api";
import { captureFinanceSession, createFinanceSession } from "./finance-session-fence";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function harness() {
  const state = { endpoint: "https://server-a.example", generation: 1, alive: true };
  const values = new Map<string, string>();
  const context: ApiRequestContext = {
    apiBase: state.endpoint,
    headers: { authorization: "Bearer original-a" },
  };
  const boundary = {
    currentEndpoint: () => state.endpoint,
    currentGeneration: () => state.generation,
    alive: () => state.alive,
    captureContext: vi.fn(async () => context),
    request: vi.fn(
      async <T>(_procedure: string, _input: unknown, _context: ApiRequestContext) =>
        ({ userId: "a" }) as T,
    ),
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      values.delete(key);
    }),
  };
  const session = createFinanceSession({ userId: "a", generation: 1, context }, boundary);
  return { state, values, context, boundary, session };
}

describe("native financial owner boundary", () => {
  it.each(["watchlist", "simulation", "research", "observation", "rule-draft", "portfolio"])(
    "does not send a %s intent when sign-out or account replacement happens during persistence",
    async (kind) => {
      const h = harness();
      const saved = deferred<void>();
      h.boundary.set.mockImplementation(async (key, value) => {
        h.values.set(key, value);
        await saved.promise;
      });
      const key = h.session.key(kind);
      const bKey = createFinanceSession(
        { userId: "b", generation: 2, context: h.context },
        h.boundary,
      ).key(kind);
      h.values.set(bKey, "b-intent");
      const submitting = (async () => {
        await h.session.persist(key, "a-intent");
        return h.session.request("finance/write", { idempotencyKey: "original-a-intent" });
      })();
      const rejected = expect(submitting).rejects.toThrow("Financial session changed");
      h.state.generation = 2;
      saved.resolve();
      await rejected;
      expect(h.boundary.request).not.toHaveBeenCalled();
      expect(h.values.get(key)).toBe("a-intent");
      expect(h.values.get(bKey)).toBe("b-intent");
    },
  );
  it("cannot bind a late me result to the new user or restore that user's pending key", async () => {
    const h = harness();
    const me = deferred<{ userId: string }>();
    h.boundary.request.mockImplementation(async <T>() => (await me.promise) as T);
    const capturing = captureFinanceSession(h.boundary);
    const rejected = expect(capturing).rejects.toThrow("Financial session changed");
    await Promise.resolve();
    h.state.generation += 1;
    me.resolve({ userId: "a" });
    await rejected;
    expect(h.boundary.get).not.toHaveBeenCalled();
  });
  it("does not request me if auth storage was captured across an endpoint cycle", async () => {
    const h = harness();
    const auth = deferred<ApiRequestContext>();
    h.boundary.captureContext.mockImplementation(() => auth.promise);
    const capturing = captureFinanceSession(h.boundary);
    const rejected = expect(capturing).rejects.toThrow("Financial session changed");
    h.state.endpoint = "https://server-b.example";
    h.state.generation += 1;
    h.state.endpoint = h.context.apiBase;
    h.state.generation += 1;
    auth.resolve(h.context);
    await rejected;
    expect(h.boundary.request).not.toHaveBeenCalled();
  });
  it("rejects a late receipt before it can clear an intent or update the current surface", async () => {
    const h = harness();
    const response = deferred<unknown>();
    h.boundary.request.mockImplementation(async <T>() => (await response.promise) as T);
    const accepted = vi.fn();
    const key = h.session.key("portfolio");
    h.values.set(key, "pending-a");
    const applying = (async () => {
      const receipt = await h.session.request("finance/portfolioCommandStatus");
      await h.session.clear(key);
      accepted(receipt);
    })();
    const rejected = expect(applying).rejects.toThrow("Financial session changed");
    h.state.generation += 1;
    response.resolve({ status: "applied" });
    await rejected;
    expect(h.boundary.delete).not.toHaveBeenCalled();
    expect(accepted).not.toHaveBeenCalled();
    expect(h.values.get(key)).toBe("pending-a");
    expect(h.boundary.request).toHaveBeenCalledWith(
      "finance/portfolioCommandStatus",
      {},
      h.context,
    );
  });
  it("a restore cannot leak a previous owner's intent after unmount", async () => {
    const h = harness();
    const storage = deferred<string | null>();
    h.boundary.get.mockImplementation(() => storage.promise);
    const restoring = h.session.restore(h.session.key("research"));
    const rejected = expect(restoring).rejects.toThrow("Financial session changed");
    h.state.alive = false;
    storage.resolve("previous-owner-intent");
    await rejected;
    expect(h.boundary.request).not.toHaveBeenCalled();
  });
  it("uses the original endpoint/headers and refuses a new endpoint before issuing the query", async () => {
    const h = harness();
    await h.session.request("finance/observations");
    expect(h.boundary.request).toHaveBeenLastCalledWith("finance/observations", {}, h.context);
    h.state.endpoint = "https://server-b.example";
    await expect(h.session.request("finance/observations")).rejects.toThrow(
      "Financial session changed",
    );
    expect(h.boundary.request).toHaveBeenCalledTimes(1);
  });
});
