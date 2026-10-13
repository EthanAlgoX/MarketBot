import { describe, expect, it, vi } from "vitest";
import { FinanceBridgeClient, resolveFinanceBridgeConfig } from "./finance-bridge.js";

const config = { url: "http://127.0.0.1:8111", token: "x".repeat(32), issuer: "test-instance" };
const ready = {
  schemaVersion: "1",
  status: "ready",
  asOf: "2026-10-12T00:00:00.000Z",
  capabilities: { liveTrading: false, simulationPrecision: "day", readOnly: true },
  watchlist: [],
  portfolio: { accounts: [], quality: "missing" },
  reports: [],
  runs: [],
  health: { schedulerOwner: "financial-engine", moneyStorage: "legacy_float", eventHighWater: 0 },
};

describe("financial bridge boundary", () => {
  it("creates only the trusted subject's binding with an empty client body", async () => {
    const http = vi.fn<typeof fetch>(async () =>
      Response.json({ status: "ready", workspaceId: "private" }),
    );
    await expect(new FinanceBridgeClient(config, http).connect("trusted-owner")).resolves.toEqual({
      status: "ready",
    });
    expect(http.mock.calls[0]?.[0]).toBe(`${config.url}/internal/assistant/v1/bindings/self`);
    expect(http.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: "{}",
      headers: { "X-Assistant-Subject": "trusted-owner" },
    });
  });
  it("keeps command retries under the same key and rejects mismatched command receipts", async () => {
    const command = {
      commandType: "watchlist.add" as const,
      idempotencyKey: "intent-1234",
      expectedRevision: 0,
      symbol: "BTCUSDT",
      market: "crypto" as const,
      name: "Bitcoin",
      reason: "长期关注",
    };
    const receipt = {
      id: "command-id",
      commandType: command.commandType,
      idempotencyKey: command.idempotencyKey,
      status: "applied",
      result: { revision: 1, watchlist: [] },
    };
    const http = vi.fn<typeof fetch>(async () => Response.json(receipt));
    const client = new FinanceBridgeClient(config, http);
    expect(await client.watchlistCommand("user", command)).toEqual(receipt);
    expect(JSON.parse(String(http.mock.calls[0]?.[1]?.body))).not.toHaveProperty("commandType");
    expect(await client.commandStatus("user", command.commandType, command.idempotencyKey)).toEqual(
      receipt,
    );
    http.mockResolvedValueOnce(Response.json({ ...receipt, idempotencyKey: "different" }));
    await expect(client.watchlistCommand("user", command)).rejects.toMatchObject({
      code: "unavailable",
    });
  });
  it("is optional and rejects incomplete or credential-bearing configuration", () => {
    expect(resolveFinanceBridgeConfig({})).toBeUndefined();
    expect(() => resolveFinanceBridgeConfig({ FINANCIAL_BRIDGE_URL: config.url })).toThrow();
    for (const url of [
      "http://example.com",
      "https://user:secret@example.com",
      "https://example.com/path",
      "https://example.com?q=x",
    ]) {
      expect(() =>
        resolveFinanceBridgeConfig({
          FINANCIAL_BRIDGE_URL: url,
          FINANCIAL_BRIDGE_TOKEN: config.token,
          FINANCIAL_BRIDGE_ISSUER: config.issuer,
        }),
      ).toThrow();
    }
  });

  it("uses the authenticated server subject and strips private workspace metadata", async () => {
    const http = vi.fn<typeof fetch>(async () =>
      Response.json({ ...ready, workspaceId: "private", databasePath: "private" }),
    );
    const result = await new FinanceBridgeClient(config, http).overview("trusted-user");
    expect(result.availability).toBe("ready");
    expect(result.data).not.toHaveProperty("workspaceId");
    expect(http.mock.calls[0]?.[1]).toMatchObject({
      redirect: "error",
      headers: {
        "X-Assistant-Subject": "trusted-user",
        "X-Assistant-Issuer": "test-instance",
        Authorization: `Bearer ${config.token}`,
      },
    });
  });

  it("distinguishes an unbound user from a service failure without leaking upstream content", async () => {
    for (const status of [401, 403, 500]) {
      const result = await new FinanceBridgeClient(
        config,
        vi.fn(async () => new Response("private path or token", { status })),
      ).overview("user");
      expect(result.availability).toBe(status === 403 ? "unbound" : "unavailable");
      expect(result.data).toBeNull();
      expect(result.message).not.toContain("private");
    }
  });

  it("rejects a malformed successful response and redirects/network errors", async () => {
    const malformed = await new FinanceBridgeClient(
      config,
      vi.fn(async () => Response.json({ portfolio: [] })),
    ).overview("user");
    expect(malformed.availability).toBe("unavailable");
    const failure = await new FinanceBridgeClient(
      config,
      vi.fn(async () => {
        throw new Error("secret");
      }),
    ).overview("user");
    expect(failure.availability).toBe("unavailable");
    expect(failure.message).not.toContain("secret");
  });

  it("rejects a mismatched cursor and signals an older financial restore", async () => {
    const page = { streamId: "stream", highWater: 0, after: 1, events: [] };
    await expect(
      new FinanceBridgeClient(
        config,
        vi.fn(async () => Response.json(page)),
      ).events("user", 0),
    ).rejects.toThrow();
    await expect(
      new FinanceBridgeClient(
        config,
        vi.fn(async () => new Response(null, { status: 409 })),
      ).events("user", 1),
    ).rejects.toMatchObject({ code: "recovery_required" });
  });
  it("reads persisted day evidence through the trusted subject and rejects a mismatched reference", async () => {
    const evidence = {
      runId: 3,
      recordId: 12,
      tradingDate: "2026-10-10",
      benchmarkClose: null,
      sources: { BTCUSDT: "public" },
      bars: {
        BTCUSDT: [
          {
            tradingDate: "2026-10-10",
            open: "1.00000001",
            close: "1.00000002",
            high: null,
            low: null,
            volume: null,
            amount: null,
            priceInputSource: "provider_decimal",
          },
        ],
      },
      privatePath: "never-expose",
    };
    const http = vi.fn<typeof fetch>(async () => Response.json(evidence));
    const client = new FinanceBridgeClient(config, http);
    const result = await client.runInputs("owned-user", 3, 12);
    expect(result.bars.BTCUSDT?.[0]?.close).toBe("1.00000002");
    expect(result).not.toHaveProperty("privatePath");
    expect(http.mock.calls[0]?.[0]).toBe(
      `${config.url}/internal/assistant/v1/runs/3/days/12/inputs`,
    );
    expect(http.mock.calls[0]?.[1]?.headers).toMatchObject({ "X-Assistant-Subject": "owned-user" });
    await expect(client.runInputs("owned-user", 3, 13)).rejects.toMatchObject({
      code: "unavailable",
    });
  });
  it("keeps model budget rejection distinct from a service failure without exposing the provider message", async () => {
    const client = new FinanceBridgeClient(
      config,
      vi.fn(async () => new Response("private provider message", { status: 429 })),
    );
    await expect(client.researchRequest("owned-user", "request-id")).rejects.toMatchObject({
      code: "rate_limited",
      message: "rate_limited",
    });
  });
});
