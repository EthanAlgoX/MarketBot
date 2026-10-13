// @vitest-environment jsdom
import type { FinanceResearchOverview, FinanceResearchRequest } from "@marketbot/contracts";
import { FinanceObservationInputSchema } from "@marketbot/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rpc } from "../../lib/rpc";
import { ResearchPanel } from "./ResearchPanel";

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
      researchOverview: vi.fn(),
      researchCommand: vi.fn(),
      researchCommandStatus: vi.fn(),
      observations: vi.fn(),
      saveObservation: vi.fn(),
      ruleDrafts: vi.fn(),
      saveRuleDraft: vi.fn(),
      ruleDraftStatus: vi.fn(),
      overview: vi.fn(),
      simulationCatalog: vi.fn(),
    },
  },
}));

// Synthetic boundary fixtures, never copied into a user's live workspace.
const task: FinanceResearchRequest = {
  id: "request-1",
  commandType: "research.create",
  idempotencyKey: "research-intent-1",
  status: "failed",
  request: { symbol: "BTCUSDT", market: "crypto", reportType: "detailed" },
  resultRef: null,
  result: null,
  error: { code: "research_usage_unverified" },
  createdAt: "2026-10-12T00:00:00Z",
  startedAt: null,
  completedAt: null,
  modelOutputs: [
    {
      callId: "call-1",
      model: "test-model",
      status: "unknown",
      output: { content: "Synthetic retained visible output", truncated: false },
    },
  ],
  cost: null,
  currency: null,
};
const fixture: FinanceResearchOverview = {
  capabilities: {
    enabled: false,
    reason: "research_disabled",
    missingDependencies: [],
    requestTokenLimit: 20000,
    dailyTokenLimit: 100000,
    maxOutputTokens: 2048,
    maxActiveRequests: 2,
    maxSourceCalls: 20,
    requestTimeoutSeconds: 120,
    sourceTimeoutSeconds: 15,
    sourceCallUnit: "provider_operation",
    cost: null,
    currency: null,
    liveTrading: false,
  },
  usage: {
    day: "2026-10-12",
    timezone: "UTC",
    tokenLimit: 100000,
    committedTokens: 5000,
    verifiedTokens: 0,
    unverifiedReservedTokens: 5000,
    remainingTokens: 95000,
    blocked: false,
    reason: null,
    modelCalls: 1,
    cost: null,
    currency: null,
  },
  requests: [task],
};
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(rpc.finance.researchOverview).mockResolvedValue(structuredClone(fixture));
  vi.mocked(rpc.finance.observations).mockResolvedValue([]);
  vi.mocked(rpc.finance.ruleDrafts).mockResolvedValue([]);
  vi.mocked(rpc.finance.overview).mockResolvedValue({
    availability: "unconfigured",
    message: null,
    data: null,
  });
  vi.mocked(rpc.finance.simulationCatalog).mockResolvedValue({
    enabled: false,
    markets: [],
    rules: [],
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const button = (label: string) =>
  [...host.querySelectorAll("button")].find((item) => item.textContent === label)!;
const render = () => act(async () => root.render(<ResearchPanel userId="reader" />));

it("blocks unconfigured research while retaining failed task output and honest budget accounting", async () => {
  await render();
  expect(button("创建研究任务").disabled).toBe(true);
  expect(host.textContent).toContain("价格未知");
  expect(host.textContent).toContain("UTC");
  expect(host.textContent).toContain("Synthetic retained visible output");
  expect(rpc.finance.researchCommand).not.toHaveBeenCalled();
});
it("restores an unknown intent as query-only and retries the same key after a missing result", async () => {
  const intent = {
    commandType: "research.create",
    idempotencyKey: "research-intent-1",
    market: "crypto",
    symbol: "BTCUSDT",
    reportType: "detailed",
  };
  sessionStorage.setItem("finance:research-intent:reader", JSON.stringify(intent));
  vi.mocked(rpc.finance.researchOverview).mockResolvedValue({
    ...fixture,
    capabilities: { ...fixture.capabilities, enabled: true, reason: null },
    requests: [],
  });
  vi.mocked(rpc.finance.researchCommandStatus).mockResolvedValue(null);
  vi.mocked(rpc.finance.researchCommand).mockResolvedValue(task);
  await render();
  expect(rpc.finance.researchCommand).not.toHaveBeenCalled();
  await act(async () => button("查询研究操作结果").click());
  expect(rpc.finance.researchCommandStatus).toHaveBeenCalledWith({
    commandType: "research.create",
    idempotencyKey: "research-intent-1",
  });
  await act(async () => button("重试同一研究操作").click());
  expect(rpc.finance.researchCommand).toHaveBeenCalledExactlyOnceWith(intent);
  expect(sessionStorage.getItem("finance:research-intent:reader")).toBeNull();
});
it("does not let another user's stored intent become a financial command", async () => {
  sessionStorage.setItem(
    "finance:research-intent:other",
    JSON.stringify({
      commandType: "research.create",
      idempotencyKey: "foreign-intent",
      market: "crypto",
      symbol: "BTCUSDT",
    }),
  );
  await render();
  expect(button("查询研究操作结果")).toBeUndefined();
  expect(rpc.finance.researchCommand).not.toHaveBeenCalled();
});

it("queries a restored observation before any save and accepts its original receipt", async () => {
  const input = {
    requestId: "completed-original-task",
    idempotencyKey: "observation-original-key",
    note: "Synthetic observation pending a known receipt",
    validUntil: null,
    invalidationCondition: null,
  };
  sessionStorage.setItem("finance:observation-intent:reader", JSON.stringify(input));
  await render();
  expect(rpc.finance.saveObservation).not.toHaveBeenCalled();
  vi.mocked(rpc.finance.observations).mockResolvedValue([
    {
      ...input,
      id: "saved-observation",
      summary: "Original summary",
      createdAt: "2026-10-12T00:00:00Z",
    },
  ]);
  await act(async () => button("查询观察记录结果").click());
  expect(sessionStorage.getItem("finance:observation-intent:reader")).toBeNull();
  expect(host.textContent).toContain("Original summary");
  expect(rpc.finance.saveObservation).not.toHaveBeenCalled();
});

it("drops the previous user's in-memory research and observation intents on an account change", async () => {
  sessionStorage.setItem(
    "finance:research-intent:reader",
    JSON.stringify({
      commandType: "research.create",
      idempotencyKey: "original-user-key",
      market: "crypto",
      symbol: "BTCUSDT",
    }),
  );
  sessionStorage.setItem(
    "finance:observation-intent:reader",
    JSON.stringify({
      requestId: "old-task",
      idempotencyKey: "original-note-key",
      note: "Prior user note",
      validUntil: null,
    }),
  );
  await render();
  expect(button("查询观察记录结果")).toBeDefined();
  await act(async () => root.render(<ResearchPanel userId="second-user" />));
  expect(button("查询研究操作结果")).toBeUndefined();
  expect(button("查询观察记录结果")).toBeUndefined();
  expect(host.textContent).not.toContain("Prior user note");
  expect(rpc.finance.saveObservation).not.toHaveBeenCalled();
});

it("saves a user-entered invalidation condition separately from an original research snapshot", async () => {
  const completed = {
    ...task,
    status: "succeeded" as const,
    resultRef: { historyId: 1 },
    result: { report: { summary: { analysis_summary: "Original finding" } } },
  };
  vi.mocked(rpc.finance.researchOverview).mockResolvedValue({ ...fixture, requests: [completed] });
  vi.mocked(rpc.finance.saveObservation).mockImplementation(async (raw) => ({
    ...FinanceObservationInputSchema.parse(raw),
    id: "saved-note",
    summary: "Original finding",
    createdAt: "2026-10-12T00:00:00Z",
  }));
  await render();
  async function fill(id: string, value: string) {
    const element = host.querySelector<HTMLSelectElement | HTMLTextAreaElement>(`#${id}`)!;
    const setter = Object.getOwnPropertyDescriptor(
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setter.call(element, value);
      element.dispatchEvent(
        new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
      );
    });
  }
  await fill("observation-research", task.id);
  await fill("observation-note", "My observation");
  await fill("observation-invalidation", "Published source contradicts the assumption");
  await act(async () =>
    host
      .querySelector("#observation-note")!
      .closest("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(rpc.finance.saveObservation).toHaveBeenCalledTimes(1);
  expect(vi.mocked(rpc.finance.saveObservation).mock.calls[0]![0]).toMatchObject({
    requestId: task.id,
    note: "My observation",
    invalidationCondition: "Published source contradicts the assumption",
    validUntil: null,
  });
  expect(host.textContent).toContain("人工反证条件");
  expect(host.textContent).toContain("Original finding");
  expect(rpc.finance.researchCommand).not.toHaveBeenCalled();
});
