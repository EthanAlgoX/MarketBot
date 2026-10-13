// @vitest-environment jsdom
import type {
  FinanceObservation,
  FinanceOverview,
  FinanceRuleDraft,
  FinanceRuleDraftInput,
} from "@marketbot/contracts";
import { FinanceRuleDraftInputSchema } from "@marketbot/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rpc } from "../../lib/rpc";
import { RuleDraftPanel } from "./RuleDraftPanel";

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
      ruleDrafts: vi.fn(),
      ruleDraftStatus: vi.fn(),
      saveRuleDraft: vi.fn(),
      overview: vi.fn(),
      simulationCatalog: vi.fn(),
      simulationCommand: vi.fn(),
    },
  },
}));

// Boundary fixtures only; never installed into a user's runtime workspace.
const observation: FinanceObservation = {
  id: "owned-observation",
  requestId: "owned-research",
  idempotencyKey: "observation-key",
  note: "Original user condition",
  summary: "Original summary",
  invalidationCondition: "Contradicting evidence",
  validUntil: null,
  createdAt: "2026-10-12T00:00:00Z",
};
const input = FinanceRuleDraftInputSchema.parse({
  observationId: observation.id,
  idempotencyKey: "draft-original-key",
  configuration: {
    name: "User rule",
    market: "crypto",
    mode: "paper",
    ruleId: "crypto_btc_hold",
    symbols: ["BTCUSDT"],
    initialCash: "1000",
  },
});
const receipt = (intent: FinanceRuleDraftInput): FinanceRuleDraft => ({
  ...intent,
  id: "saved-draft",
  requestId: observation.requestId,
  status: "draft",
  versionBinding: "on_simulation_create",
  rule: { id: "crypto_btc_hold", name: "BTC hold", market: "crypto" },
  researchSnapshot: {
    request: { symbol: "BTCUSDT" },
    result: { report: "Synthetic original report" },
  },
  researchSnapshotDigest: "a".repeat(64),
  createdAt: "2026-10-12T00:00:00Z",
});
const overview: FinanceOverview = {
  availability: "ready",
  message: null,
  data: {
    schemaVersion: "1",
    status: "ready",
    asOf: "2026-10-12T00:00:00Z",
    watchlistRevision: 0,
    watchlist: [],
    portfolio: { quality: "missing", accounts: [] },
    reports: [],
    runs: [],
    capabilities: {
      readOnly: false,
      liveTrading: false,
      simulationPrecision: "day",
      supportedCommands: ["simulation.create"],
    },
    health: { schedulerOwner: "financial-engine", moneyStorage: "legacy_float", eventHighWater: 0 },
  },
};
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(rpc.finance.ruleDrafts).mockResolvedValue([]);
  vi.mocked(rpc.finance.overview).mockResolvedValue(overview);
  vi.mocked(rpc.finance.simulationCatalog).mockResolvedValue({
    enabled: true,
    markets: ["crypto"],
    rules: [
      { id: "crypto_btc_hold", name: "BTC hold", market: "crypto", available: true, reason: null },
    ],
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const render = (observations: FinanceObservation[] = [observation], userId = "reader") =>
  act(async () => root.render(<RuleDraftPanel observations={observations} userId={userId} />));
const button = (label: string) =>
  [...host.querySelectorAll("button")].find((item) => item.textContent === label)!;
async function fill(id: string, value: string) {
  const element = host.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  const setter = Object.getOwnPropertyDescriptor(
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
}
it("shows no save form without a real saved observation", async () => {
  await render([]);
  expect(host.querySelector("form")).toBeNull();
  expect(rpc.finance.simulationCatalog).not.toHaveBeenCalled();
  expect(rpc.finance.saveRuleDraft).not.toHaveBeenCalled();
});
it("keeps existing drafts readable and copyable when the rule gate is closed", async () => {
  vi.mocked(rpc.finance.ruleDrafts).mockResolvedValue([receipt(input)]);
  vi.mocked(rpc.finance.simulationCatalog).mockResolvedValue({
    enabled: false,
    markets: [],
    rules: [],
  });
  const copy = vi.fn(async (_value: string) => undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: copy }, configurable: true });
  await render();
  expect(host.querySelector("form")).toBeNull();
  expect(host.textContent).toContain("规则版本尚未冻结");
  await act(async () => button("复制配置").click());
  expect(JSON.parse(copy.mock.calls[0]![0])).toEqual(input.configuration);
  expect(rpc.finance.simulationCommand).not.toHaveBeenCalled();
});
it("queries an unknown saved draft before retrying its original key and fixed configuration", async () => {
  sessionStorage.setItem("finance:rule-draft-intent:reader", JSON.stringify(input));
  vi.mocked(rpc.finance.ruleDraftStatus).mockResolvedValue(null);
  vi.mocked(rpc.finance.saveRuleDraft).mockResolvedValue(receipt(input));
  await render();
  expect(rpc.finance.saveRuleDraft).not.toHaveBeenCalled();
  expect(button("重试同一规则草稿")).toBeUndefined();
  await act(async () => button("查询草稿保存结果").click());
  expect(rpc.finance.ruleDraftStatus).toHaveBeenCalledExactlyOnceWith({
    idempotencyKey: input.idempotencyKey,
  });
  await act(async () => button("重试同一规则草稿").click());
  expect(rpc.finance.saveRuleDraft).toHaveBeenCalledExactlyOnceWith(input);
  expect(sessionStorage.getItem("finance:rule-draft-intent:reader")).toBeNull();
  expect(rpc.finance.simulationCommand).not.toHaveBeenCalled();
});
it("saves an explicitly filled rule configuration without starting a simulation", async () => {
  vi.mocked(rpc.finance.saveRuleDraft).mockImplementation(async (intent) =>
    receipt(FinanceRuleDraftInputSchema.parse(intent)),
  );
  await render();
  await fill("draft-observation", observation.id);
  await fill("draft-rule", "crypto_btc_hold");
  await fill("draft-name", "Explicit user draft");
  await fill("draft-cash", "1000");
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(rpc.finance.saveRuleDraft).toHaveBeenCalledTimes(1);
  expect(vi.mocked(rpc.finance.saveRuleDraft).mock.calls[0]![0]).toMatchObject({
    observationId: observation.id,
    configuration: {
      name: "Explicit user draft",
      ruleId: "crypto_btc_hold",
      symbols: ["BTCUSDT"],
      initialCash: "1000",
    },
  });
  expect(host.textContent).toContain("未运行草稿");
  expect(rpc.finance.simulationCommand).not.toHaveBeenCalled();
});
