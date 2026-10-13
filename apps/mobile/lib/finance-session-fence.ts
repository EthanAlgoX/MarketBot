import type { ApiRequestContext } from "./api";

type Boundary = {
  currentEndpoint: () => string;
  currentGeneration: () => number;
  alive: () => boolean;
  request: (procedure: string, input: unknown, context: ApiRequestContext) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

/** Capture the epoch before either auth storage or `me` can yield to a new owner. */
export async function captureFinanceSession(
  boundary: Boundary & { captureContext: () => Promise<ApiRequestContext> },
) {
  const generation = boundary.currentGeneration();
  const endpoint = boundary.currentEndpoint();
  const current = () =>
    boundary.alive() &&
    generation === boundary.currentGeneration() &&
    endpoint === boundary.currentEndpoint();
  const assertCurrent = () => {
    if (!current()) throw new Error("Financial session changed");
  };
  assertCurrent();
  const context = await boundary.captureContext();
  assertCurrent();
  if (context.apiBase !== endpoint) throw new Error("Financial session changed");
  const me = await boundary.request("me", {}, context);
  assertCurrent();
  if (
    !me ||
    typeof me !== "object" ||
    !("userId" in me) ||
    typeof me.userId !== "string" ||
    !me.userId
  )
    throw new Error("Financial session owner unavailable");
  return createFinanceSession({ userId: me.userId, generation, context }, boundary);
}

/** One mounted owner, one session epoch, one endpoint and fixed authentication headers. */
export function createFinanceSession(
  identity: { userId: string; generation: number; context: ApiRequestContext },
  boundary: Boundary,
) {
  const isCurrent = () =>
    boundary.alive() &&
    boundary.currentGeneration() === identity.generation &&
    boundary.currentEndpoint() === identity.context.apiBase;
  const assertCurrent = () => {
    if (!isCurrent()) throw new Error("Financial session changed");
  };
  return {
    userId: identity.userId,
    isCurrent,
    key(kind: string) {
      const endpoint = Array.from(identity.context.apiBase, (char) =>
        char.charCodeAt(0).toString(16).padStart(2, "0"),
      ).join("");
      return `finance.${kind}.${endpoint}.${identity.userId}`;
    },
    async restore(key: string) {
      assertCurrent();
      const value = await boundary.get(key);
      assertCurrent();
      return value;
    },
    async persist(key: string, value: string) {
      assertCurrent();
      await boundary.set(key, value);
      assertCurrent();
    },
    async clear(key: string) {
      assertCurrent();
      await boundary.delete(key);
      assertCurrent();
    },
    async request<T = unknown>(procedure: string, input: unknown = {}) {
      assertCurrent();
      const value = await boundary.request(procedure, input, identity.context);
      assertCurrent();
      return value as T;
    },
  };
}
export type FinanceSession = ReturnType<typeof createFinanceSession>;
