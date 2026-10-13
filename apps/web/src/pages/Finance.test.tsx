// @vitest-environment jsdom
import type { FinanceOverview } from "@marketbot/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rpc } from "../lib/rpc";
import { FinancePage } from "./Finance";

vi.mock("@lingui/react/macro", () => {
  const t = (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((text, part, index) => text + part + (values[index] ?? ""), "");
  return {
    useLingui: () => ({ t }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock("@marketbot/ui-web", () => ({
  Button: ({
    children,
    variant: _variant,
    ...props
  }: ComponentProps<"button"> & { variant?: string }) => <button {...props}>{children}</button>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Skeleton: ({ className }: { className?: string }) => <div data-skeleton className={className} />,
  Input: (props: ComponentProps<"input">) => <input {...props} />,
  Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
  Label: ({ htmlFor, children, ...props }: ComponentProps<"label">) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
  NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
  NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
}));
vi.mock("./WindowChrome", () => ({ WindowChrome: () => null }));
vi.mock("../lib/rpc", () => ({
  rpc: {
    me: vi.fn(),
    finance: {
      connect: vi.fn(),
      overview: vi.fn(),
      notifications: vi.fn(),
      markRead: vi.fn(),
      run: vi.fn(),
      watchlistCommand: vi.fn(),
      commandStatus: vi.fn(),
      simulationCatalog: vi.fn(),
      simulationCommand: vi.fn(),
      simulationCommandStatus: vi.fn(),
      portfolioAccounts: vi.fn(async () => ({ accounts: [] })),
      portfolioAccount: vi.fn(),
      portfolioPreview: vi.fn(),
      portfolioCommand: vi.fn(),
      portfolioCommandStatus: vi.fn(),
    },
  },
}));

/** Synthetic boundary fixture, never installed into a runtime database. */
const ready: FinanceOverview = {
  availability: "ready",
  message: null,
  data: {
    schemaVersion: "1",
    status: "ready",
    asOf: "2026-10-12T00:00:00Z",
    capabilities: {
      liveTrading: false,
      simulationPrecision: "day",
      readOnly: true,
      supportedCommands: [],
    },
    watchlistRevision: 0,
    watchlist: [
      {
        assetId: "crypto:BTCUSDT",
        symbol: "BTCUSDT",
        name: "Bitcoin",
        market: "crypto",
        currency: "USDT",
        reason: "",
      },
    ],
    portfolio: {
      quality: "stale",
      accounts: [
        {
          id: 1,
          name: "Synthetic account",
          market: "crypto",
          currency: "USDT",
          snapshotDate: "2026-10-10",
          quality: "stale",
          cash: "989.990000000000000001",
          equity: "999.990000000000000001",
          marketValue: "10",
          positions: [],
        },
      ],
    },
    reports: [],
    runs: [],
    health: {
      schedulerOwner: "financial-engine",
      moneyStorage: "legacy_float",
      eventHighWater: 0,
      precisionAudit: "pending",
    },
  },
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(rpc.finance.notifications).mockResolvedValue({ items: [] });
  vi.mocked(rpc.finance.simulationCatalog).mockResolvedValue({
    enabled: false,
    markets: [],
    rules: [],
  });
  vi.mocked(rpc.me).mockResolvedValue({
    userId: "test-user",
    email: "test@example.com",
    name: "Test user",
    spaceId: "test-space",
    isDeploymentOwner: false,
    needsModel: false,
    defaultProvider: null,
    defaultModel: null,
    computerHost: null,
    canChooseHostComputer: false,
    sandboxProvider: "docker",
    avatarStyle: "robot",
    billingEnabled: false,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(userId = "test-user") {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinancePage userId={userId} />
      </MemoryRouter>,
    ),
  );
}
function button(text: string) {
  return [...host.querySelectorAll("button")].find((item) => item.textContent === text)!;
}

it("shows an unbound workspace without inventing an empty personal portfolio", async () => {
  vi.mocked(rpc.finance.overview).mockResolvedValue({
    availability: "unbound",
    message: "Workspace not bound",
    data: null,
  });
  await render();
  expect(host.textContent).toContain("金融工作区尚未绑定");
  expect(host.textContent).not.toContain("尚未记录持仓");
  expect(host.textContent).not.toContain("USDT");
  expect(button("创建金融工作区")).toBeUndefined();
  expect(rpc.finance.connect).not.toHaveBeenCalled();
});

it("lets the owner explicitly create an unbound workspace without automatically connecting", async () => {
  vi.mocked(rpc.finance.overview).mockResolvedValue({
    availability: "unbound",
    message: null,
    data: null,
  });
  vi.mocked(rpc.me).mockResolvedValue({ ...(await rpc.me()), isDeploymentOwner: true });
  vi.mocked(rpc.finance.connect).mockResolvedValue(ready);
  await render();
  expect(rpc.finance.connect).not.toHaveBeenCalled();
  await act(async () => button("创建金融工作区").click());
  expect(rpc.finance.connect).toHaveBeenCalledWith({});
  expect(host.textContent).toContain("Bitcoin");
});

it("keeps precision and stale quality visible in the account view", async () => {
  vi.mocked(rpc.finance.overview).mockResolvedValue(ready);
  await render();
  await act(async () => button("持仓").click());
  expect(host.textContent).toContain("989.990000000000000001");
  expect(host.textContent).toContain("数据陈旧");
  expect(rpc.finance.overview).toHaveBeenCalledWith({});
});

it("distinguishes an unavailable holdings snapshot from a confirmed empty snapshot", async () => {
  const missing = structuredClone(ready);
  missing.data!.portfolio.accounts[0]!.quality = "missing";
  missing.data!.portfolio.accounts[0]!.snapshotDate = null;
  vi.mocked(rpc.finance.overview).mockResolvedValue(missing);
  await render();
  await act(async () => button("持仓").click());
  expect(host.textContent).toContain("持仓快照尚不可用");
  expect(host.textContent).not.toContain("没有持仓记录");
});

it("does not expose simulation writes when the server capability is closed", async () => {
  vi.mocked(rpc.finance.overview).mockResolvedValue(ready);
  await render();
  await act(async () => button("模拟策略").click());
  expect(button("创建模拟账户")).toBeUndefined();
  expect(rpc.finance.simulationCommand).not.toHaveBeenCalled();
});

it("queries an uncertain simulation control and retries the original command once missing is confirmed", async () => {
  const editable = structuredClone(ready);
  editable.data!.capabilities.supportedCommands = ["simulation.start"];
  editable.data!.runs = [
    {
      id: 1,
      name: "Synthetic paper account",
      market: "crypto",
      mode: "paper",
      status: "ready",
      lastTradingDate: null,
      nextCheckAt: null,
      executionPrecision: "day",
      decisionBackend: "rule",
      currency: "USDT",
      cash: "1000",
      equity: "1000",
      revision: 0,
      ledgerPrecision: "decimal_v1",
    },
  ];
  vi.mocked(rpc.finance.overview).mockResolvedValue(editable);
  vi.mocked(rpc.finance.simulationCatalog).mockResolvedValue({
    enabled: true,
    markets: ["crypto"],
    rules: [],
  });
  vi.mocked(rpc.finance.simulationCommand)
    .mockRejectedValueOnce(new Error("Network timeout"))
    .mockImplementationOnce(async (command) => ({
      id: "synthetic-receipt",
      commandType: command.commandType,
      idempotencyKey: command.idempotencyKey,
      status: "applied",
      result: { runId: 1, status: "running", revision: 1, ledgerPrecision: "decimal_v1" },
    }));
  vi.mocked(rpc.finance.simulationCommandStatus).mockResolvedValue(null);
  await render();
  await act(async () => button("模拟策略").click());
  await act(async () => button("启动模拟").click());
  const original = vi.mocked(rpc.finance.simulationCommand).mock.calls[0]![0];
  expect(button("重试同一模拟操作")).toBeUndefined();
  await act(async () => button("查询模拟操作结果").click());
  expect(rpc.finance.simulationCommandStatus).toHaveBeenCalledWith({
    commandType: original.commandType,
    idempotencyKey: original.idempotencyKey,
  });
  await act(async () => button("重试同一模拟操作").click());
  expect(vi.mocked(rpc.finance.simulationCommand).mock.calls[1]![0]).toEqual(original);
});

it("retains the previous reading with an explicit stale display after a failed refresh", async () => {
  vi.mocked(rpc.finance.overview)
    .mockResolvedValueOnce(ready)
    .mockRejectedValueOnce(new Error("Service disconnected"));
  await render();
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="刷新金融数据"]')!.click(),
  );
  expect(host.textContent).toContain("Bitcoin");
  expect(host.textContent).toContain("当前显示上次读取结果");
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});

it("persists notification feedback before displaying the server read state", async () => {
  vi.mocked(rpc.finance.overview).mockResolvedValue(ready);
  const notification = {
    id: "event-test",
    title: "Bridge check",
    body: "Test event",
    kind: "integration.test",
    recordedAt: "2026-10-12T00:00:00Z",
    readAt: null,
    pushStatus: "unavailable" as const,
    pushAttempts: 0,
    lastPushAt: null,
  };
  vi.mocked(rpc.finance.notifications)
    .mockResolvedValueOnce({ items: [notification] })
    .mockResolvedValueOnce({ items: [{ ...notification, readAt: "2026-10-12T00:01:00Z" }] });
  vi.mocked(rpc.finance.markRead).mockResolvedValue({ ok: true });
  await render();
  expect(host.textContent).toContain("集成测试");
  await act(async () => button("标为已读").click());
  expect(rpc.finance.markRead).toHaveBeenCalledWith({ id: "event-test" });
  expect(rpc.finance.notifications).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain("已读");
});

it("queries an uncertain watchlist operation before retrying the identical command", async () => {
  const editable = structuredClone(ready);
  editable.data!.capabilities.readOnly = false;
  editable.data!.capabilities.supportedCommands = ["watchlist.add", "watchlist.remove"];
  vi.mocked(rpc.finance.overview).mockResolvedValue(editable);
  vi.mocked(rpc.finance.watchlistCommand)
    .mockRejectedValueOnce(new Error("Network timeout"))
    .mockImplementationOnce(async (command) => ({
      id: "synthetic-command",
      commandType: command.commandType,
      idempotencyKey: command.idempotencyKey,
      status: "applied",
      result: { revision: 1, watchlist: [] },
    }));
  vi.mocked(rpc.finance.commandStatus).mockResolvedValue(null);
  await render();
  await act(async () => button("移除").click());
  const original = vi.mocked(rpc.finance.watchlistCommand).mock.calls[0]![0];
  expect(original).toMatchObject({
    commandType: "watchlist.remove",
    expectedRevision: 0,
    symbol: "BTCUSDT",
    market: "crypto",
  });
  expect(button("重试同一操作")).toBeUndefined();
  await act(async () => button("查询操作结果").click());
  expect(rpc.finance.commandStatus).toHaveBeenCalledWith({
    commandType: original.commandType,
    idempotencyKey: original.idempotencyKey,
  });
  await act(async () => button("重试同一操作").click());
  expect(vi.mocked(rpc.finance.watchlistCommand).mock.calls[1]![0]).toEqual(original);
  expect(host.textContent).not.toContain("Bitcoin");
});

it("restores an unresolved intent when returning from another financial view", async () => {
  const editable = structuredClone(ready);
  editable.data!.capabilities.readOnly = false;
  editable.data!.capabilities.supportedCommands = ["watchlist.remove"];
  vi.mocked(rpc.finance.overview).mockResolvedValue(editable);
  vi.mocked(rpc.finance.watchlistCommand).mockRejectedValue(new Error("Network timeout"));
  vi.mocked(rpc.finance.commandStatus).mockResolvedValue(null);
  await render("synthetic-reader");
  await act(async () => button("移除").click());
  const original = vi.mocked(rpc.finance.watchlistCommand).mock.calls[0]![0];
  await act(async () => button("持仓").click());
  await act(async () => button("总览").click());
  expect(rpc.finance.watchlistCommand).toHaveBeenCalledTimes(1);
  expect(button("移除").disabled).toBe(true);
  await act(async () => button("查询操作结果").click());
  expect(rpc.finance.commandStatus).toHaveBeenCalledWith({
    commandType: original.commandType,
    idempotencyKey: original.idempotencyKey,
  });
});

it("remounts personal financial state and command intents when the authenticated user changes", async () => {
  const first = structuredClone(ready);
  first.data!.capabilities.readOnly = false;
  first.data!.capabilities.supportedCommands = ["watchlist.remove"];
  const second = structuredClone(first);
  second.data!.watchlist = [];
  sessionStorage.setItem(
    "finance:watchlist-intent:old-user",
    JSON.stringify({
      commandType: "watchlist.remove",
      idempotencyKey: "old-user-intent",
      expectedRevision: 0,
      symbol: "BTCUSDT",
      market: "crypto",
    }),
  );
  sessionStorage.setItem(
    "finance:simulation-intent:old-user",
    JSON.stringify({
      commandType: "simulation.start",
      idempotencyKey: "old-user-simulation-intent",
      runId: 1,
      expectedRevision: 0,
    }),
  );
  vi.mocked(rpc.finance.overview).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  await render("old-user");
  expect(button("查询操作结果")).toBeDefined();
  await act(async () => button("模拟策略").click());
  expect(button("查询模拟操作结果")).toBeDefined();
  await render("new-user");
  expect(button("查询操作结果")).toBeUndefined();
  expect(host.textContent).not.toContain("Bitcoin");
  expect(host.textContent).toContain("金融工作区还没有自选标的");
  await act(async () => button("模拟策略").click());
  expect(button("查询模拟操作结果")).toBeUndefined();
  expect(rpc.finance.watchlistCommand).not.toHaveBeenCalled();
  expect(rpc.finance.simulationCommand).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("finance:watchlist-intent:old-user")).not.toBeNull();
  expect(sessionStorage.getItem("finance:simulation-intent:old-user")).not.toBeNull();
});

it("ignores an old user's late overview response after changing identity in the same React root", async () => {
  let resolveOld!: (value: FinanceOverview) => void;
  const oldResponse = new Promise<FinanceOverview>((resolve) => {
    resolveOld = resolve;
  });
  const second = structuredClone(ready);
  second.data!.watchlist = [];
  second.data!.portfolio = { quality: "missing", accounts: [] };
  vi.mocked(rpc.finance.overview).mockReturnValueOnce(oldResponse).mockResolvedValueOnce(second);
  await render("old-user");
  expect(host.querySelector("[data-skeleton]")).not.toBeNull();
  await render("new-user");
  expect(host.textContent).toContain("金融工作区还没有自选标的");
  await act(async () => resolveOld(ready));
  expect(host.textContent).not.toContain("Bitcoin");
  expect(host.textContent).toContain("金融工作区还没有自选标的");
  await act(async () => button("持仓").click());
  expect(host.textContent).not.toContain("Synthetic account");
  expect(host.textContent).toContain("尚未记录持仓");
  expect(rpc.finance.overview).toHaveBeenCalledTimes(2);
});
