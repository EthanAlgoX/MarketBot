// @vitest-environment jsdom
import type { FinancePortfolioAccountDetail, FinancePortfolioCommand } from "@marketbot/contracts";
import { FINANCE_TRADE_CSV_HEADER } from "@marketbot/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rpc } from "../../lib/rpc";
import { ManualPortfolio } from "./ManualPortfolio";

vi.mock("@lingui/react/macro", () => {
  const t = (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((text, part, index) => text + part + (values[index] ?? ""), "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@marketbot/ui-web", () => ({
  Button: ({ variant: _variant, ...props }: ComponentProps<"button"> & { variant?: string }) => (
    <button {...props} />
  ),
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
vi.mock("../../lib/rpc", () => ({
  rpc: {
    finance: {
      portfolioAccounts: vi.fn(),
      portfolioAccount: vi.fn(),
      portfolioPreview: vi.fn(),
      portfolioCommand: vi.fn(),
      portfolioCommandStatus: vi.fn(),
    },
  },
}));

const detail: FinancePortfolioAccountDetail = {
  account: {
    id: 2,
    name: "Synthetic manual ledger",
    market: "crypto",
    currency: "USDT",
    ledgerKind: "manual",
    assistantCreated: true,
    revision: 3,
    ledgerPrecision: "legacy_float",
  },
  availableCash: null,
  cashLedgerNet: "1000",
  holdings: [],
  trades: [],
  cashEntries: [],
  warnings: [],
  historyTruncated: false,
};
const intent: FinancePortfolioCommand = {
  commandType: "portfolio.cash.record",
  idempotencyKey: "stable-cash-test",
  accountId: 2,
  expectedRevision: 3,
  eventDate: "2026-10-10",
  direction: "deposit",
  amount: "1000",
  currency: "USDT",
  note: "",
};
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const changed = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(rpc.finance.portfolioAccounts).mockResolvedValue({ accounts: [detail.account] });
  vi.mocked(rpc.finance.portfolioAccount).mockResolvedValue(structuredClone(detail));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const render = (userId = "user-a") =>
  act(async () =>
    root.render(<ManualPortfolio userId={userId} refreshKey={0} onChanged={changed} />),
  );
const button = (label: string) =>
  [...host.querySelectorAll("button")].find((element) => element.textContent === label)!;

it("restores an unknown write as query-only and retries the exact body only after missing status", async () => {
  sessionStorage.setItem("finance.portfolio.user-a", JSON.stringify(intent));
  vi.mocked(rpc.finance.portfolioCommandStatus).mockResolvedValue(null);
  vi.mocked(rpc.finance.portfolioCommand).mockResolvedValue({
    id: "cash-receipt",
    commandType: "portfolio.cash.record",
    idempotencyKey: intent.idempotencyKey,
    status: "applied",
    result: { accountId: 2, revision: 4, cashEntryId: 1, ledgerPrecision: "legacy_float" },
  });
  await render();
  expect(rpc.finance.portfolioCommand).not.toHaveBeenCalled();
  expect(button("保存流水").disabled).toBe(true);
  await act(async () => button("查询原操作").click());
  expect(rpc.finance.portfolioCommandStatus).toHaveBeenCalledExactlyOnceWith({
    commandType: intent.commandType,
    idempotencyKey: intent.idempotencyKey,
  });
  await act(async () => button("按原编号重试").click());
  expect(rpc.finance.portfolioCommand).toHaveBeenCalledExactlyOnceWith(intent);
  expect(sessionStorage.getItem("finance.portfolio.user-a")).toBeNull();
});

it("keeps cash ledger deposits separate from an unknown available balance", async () => {
  await render();
  expect(host.textContent?.replace(/\s+/g, "")).toContain("资金流水净额1000USDT");
  expect(host.textContent).toContain("可用余额未知");
  expect(host.textContent).toContain("Float");
  expect(rpc.finance.portfolioCommand).not.toHaveBeenCalled();
});

it("previews template records without a write and blocks a conflicting row", async () => {
  vi.mocked(rpc.finance.portfolioPreview).mockResolvedValue({
    accountId: 2,
    revision: 3,
    previewHash: "a".repeat(64),
    canCommit: false,
    insertCount: 0,
    duplicateCount: 0,
    rows: [{ index: 0, status: "conflict", error: "portfolio_uid_conflict", record: null }],
    warnings: ["portfolio_oversell"],
  });
  await render();
  const textarea = host.querySelector<HTMLTextAreaElement>("#trade-csv")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      textarea,
      `${FINANCE_TRADE_CSV_HEADER}\nt-1,2026-10-10,BTCUSDT,crypto,USDT,buy,0.1,80000,0,0,`,
    );
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => button("预览与查重").click());
  expect(rpc.finance.portfolioPreview).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: 2, expectedRevision: 3 }),
  );
  expect(button("确认导入记账账户").disabled).toBe(true);
  expect(host.textContent).toContain("冲突");
  expect(host.textContent).toContain("同一原始交易编号对应不同内容");
  expect(host.textContent).toContain("卖出数量超过截至该日的持仓");
  expect(host.textContent).not.toContain("portfolio_uid_conflict");
  expect(rpc.finance.portfolioCommand).not.toHaveBeenCalled();
});

it("clears another account's cached ledger and pending write in the same React root", async () => {
  sessionStorage.setItem("finance.portfolio.user-a", JSON.stringify(intent));
  await render();
  expect(host.textContent).toContain(detail.account.name);
  vi.mocked(rpc.finance.portfolioAccounts).mockResolvedValue({ accounts: [] });
  await render("user-b");
  expect(host.textContent).not.toContain(detail.account.name);
  expect(host.textContent).not.toContain("原操作结果待确认");
  expect(sessionStorage.getItem("finance.portfolio.user-a")).not.toBeNull();
  expect(rpc.finance.portfolioCommand).not.toHaveBeenCalled();
});
