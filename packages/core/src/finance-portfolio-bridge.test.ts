import { describe, expect, it, vi } from "vitest";
import { FinanceBridgeClient } from "./finance-bridge.js";

const account = {
  id: 2,
  name: "Private manual ledger",
  market: "crypto",
  currency: "USDT",
  ledgerKind: "manual",
  assistantCreated: true,
  revision: 3,
  ledgerPrecision: "legacy_float",
};
const record = {
  externalId: "row-1",
  tradeDate: "2026-10-10",
  symbol: "BTCUSDT",
  market: "crypto" as const,
  currency: "USDT" as const,
  side: "buy" as const,
  quantity: "0.1",
  price: "80000",
  fee: "0",
  tax: "0",
  note: "",
};
function setup(result: unknown) {
  const http = vi.fn<typeof fetch>(async () => Response.json(result));
  const bridge = new FinanceBridgeClient(
    { url: "http://127.0.0.1:8111", token: "t".repeat(32), issuer: "local-test" },
    http,
  );
  return { bridge, http };
}

describe("manual portfolio financial bridge", () => {
  it("keeps an explicitly oversized import rejection separate from an unknown write outcome", async () => {
    const bridge = new FinanceBridgeClient(
      { url: "http://127.0.0.1:8111", token: "t".repeat(32), issuer: "local-test" },
      vi.fn<typeof fetch>(async () => new Response(null, { status: 413 })),
    );
    await expect(
      bridge.portfolioCommand("user-a", {
        commandType: "portfolio.account.create",
        idempotencyKey: "oversized-create",
        name: "Manual",
        market: "crypto",
        currency: "USDT",
      }),
    ).rejects.toMatchObject({ code: "bad_request" });
  });
  it("treats a missing command receipt as retryable absence without concealing service or auth failure", async () => {
    for (const status of [404, 403, 500]) {
      const bridge = new FinanceBridgeClient(
        { url: "http://127.0.0.1:8111", token: "t".repeat(32), issuer: "local-test" },
        vi.fn<typeof fetch>(async () => new Response(null, { status })),
      );
      const queries = [
        () => bridge.portfolioCommandStatus("user-a", "portfolio.account.create", "missing-key"),
        () => bridge.commandStatus("user-a", "watchlist.add", "missing-key"),
        () => bridge.simulationCommandStatus("user-a", "simulation.create", "missing-key"),
        () => bridge.researchCommandStatus("user-a", "research.create", "missing-key"),
      ];
      for (const query of queries) {
        if (status === 404) await expect(query()).resolves.toBeNull();
        else
          await expect(query()).rejects.toMatchObject({
            code: status === 403 ? "unbound" : "unavailable",
          });
      }
      await expect(bridge.portfolioAccount("user-a", 2)).rejects.toMatchObject({
        code: status === 404 ? "not_found" : status === 403 ? "unbound" : "unavailable",
      });
    }
  });
  it("translates only to the trusted subject and checks account echo", async () => {
    const result = {
      account,
      availableCash: null,
      cashLedgerNet: "0",
      holdings: [],
      trades: [],
      cashEntries: [],
      warnings: [],
      historyTruncated: false,
    };
    const { bridge, http } = setup(result);
    await expect(bridge.portfolioAccount("user-a", 2)).resolves.toEqual(result);
    expect(http).toHaveBeenCalledWith(
      "http://127.0.0.1:8111/internal/assistant/v1/portfolio/accounts/2",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Assistant-Subject": "user-a" }),
        redirect: "error",
      }),
    );
    await expect(bridge.portfolioAccount("user-a", 3)).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("rejects previews from a changed account revision or malformed row mapping", async () => {
    const input = { accountId: 2, expectedRevision: 3, records: [record] };
    const preview = {
      accountId: 2,
      revision: 3,
      previewHash: "a".repeat(64),
      canCommit: true,
      insertCount: 1,
      duplicateCount: 0,
      rows: [{ index: 0, status: "insert", error: null, record }],
      warnings: [],
    };
    await expect(setup(preview).bridge.portfolioPreview("user-a", input)).resolves.toEqual(preview);
    for (const changed of [
      { ...preview, revision: 4 },
      { ...preview, accountId: 3 },
      { ...preview, rows: [] },
      { ...preview, rows: [{ ...preview.rows[0], index: 1 }] },
    ]) {
      await expect(setup(changed).bridge.portfolioPreview("user-a", input)).rejects.toMatchObject({
        code: "unavailable",
      });
    }
  });

  it("checks stable command key/type/account and queries without replay", async () => {
    const command = {
      commandType: "portfolio.cash.record" as const,
      idempotencyKey: "cash-test-1",
      accountId: 2,
      expectedRevision: 3,
      eventDate: "2026-10-10",
      direction: "deposit" as const,
      amount: "1000",
      currency: "USDT" as const,
      note: "",
    };
    const receipt = {
      id: "cmd-test",
      commandType: command.commandType,
      idempotencyKey: command.idempotencyKey,
      status: "applied",
      result: { accountId: 2, revision: 4, cashEntryId: 1, ledgerPrecision: "legacy_float" },
    };
    const { bridge, http } = setup(receipt);
    await expect(bridge.portfolioCommand("user-a", command)).resolves.toEqual(receipt);
    const { commandType: _type, ...body } = command;
    expect(http.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(body));
    await bridge.portfolioCommandStatus("user-a", command.commandType, command.idempotencyKey);
    expect(http.mock.calls[1]?.[1]?.method).toBe("GET");
    for (const changed of [
      { ...receipt, idempotencyKey: "different-key" },
      { ...receipt, result: { ...receipt.result, accountId: 3 } },
    ]) {
      await expect(setup(changed).bridge.portfolioCommand("user-a", command)).rejects.toMatchObject(
        {
          code: "unavailable",
        },
      );
    }
  });
});
