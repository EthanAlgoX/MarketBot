import { Trans, useLingui } from "@lingui/react/macro";
import type {
  FinanceSimulationCatalog,
  FinanceSimulationCommand,
  FinanceSimulationCommandResult,
  FinanceWorkspaceOverview,
} from "@marketbot/contracts";
import {
  FinanceSimulationCatalogSchema,
  FinanceSimulationCommandResultSchema,
  FinanceSimulationCommandSchema,
} from "@marketbot/contracts";
import { Button, Input, Label, NativeSelect, NativeSelectOption } from "@marketbot/ui-web";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { newClientId } from "../../lib/client-id";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

export function SimulationControls({
  data,
  userId,
  refreshKey,
  onApplied,
}: {
  data: FinanceWorkspaceOverview;
  userId?: string;
  refreshKey: number;
  onApplied: (result: FinanceSimulationCommandResult) => void;
}) {
  const { t } = useLingui();
  const storageKey = userId ? `finance:simulation-intent:${userId}` : null;
  const [catalog, setCatalog] = useState<FinanceSimulationCatalog | null>(null);
  const [pending, setPending] = useState<FinanceSimulationCommand | null>(() => {
    if (!storageKey) return null;
    try {
      const value = sessionStorage.getItem(storageKey);
      return value ? FinanceSimulationCommandSchema.parse(JSON.parse(value)) : null;
    } catch {
      return null;
    }
  });
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ruleId, setRuleId] = useState("crypto_btc_hold");
  const [mode, setMode] = useState<"paper" | "backtest">("paper");
  const [symbols, setSymbols] = useState("");
  const [cash, setCash] = useState("");
  const [commission, setCommission] = useState("0.001");
  const [slippage, setSlippage] = useState("0.0005");
  const [sellTax, setSellTax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    void rpc.finance
      .simulationCatalog({})
      .then((value) => {
        if (!cancelled) {
          const parsed = FinanceSimulationCatalogSchema.parse(value);
          setCatalog(parsed);
          const available = parsed.rules.filter(
            (rule) => rule.available && parsed.markets.includes(rule.market),
          );
          setRuleId((current) =>
            available.some((rule) => rule.id === current) ? current : (available[0]?.id ?? current),
          );
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setCatalog(null);
          setError(errorText(failure, t`无法读取模拟规则目录`));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, t]);

  const supported = data.capabilities.supportedCommands;
  const inactive = busy || pending !== null || !storageKey;
  const rules =
    catalog?.rules.filter((rule) => rule.available && catalog.markets.includes(rule.market)) ?? [];
  const selectedRule = rules.find((rule) => rule.id === ruleId);
  const canCreate = !!catalog?.enabled && supported.includes("simulation.create") && !!selectedRule;
  function clearIntent() {
    if (storageKey) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Recover by querying this receipt on the next visit. */
      }
    }
  }
  function applied(result: FinanceSimulationCommandResult) {
    clearIntent();
    setPending(null);
    setMissing(false);
    setError(null);
    setStatus(t`操作已应用，运行结果由后台更新。`);
    onApplied(result);
    if (result.commandType === "simulation.create") {
      setName("");
      setCash("");
      setSymbols("");
    }
  }
  async function send(command: FinanceSimulationCommand) {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(command));
    } catch {
      setError(t`无法保存操作编号，本次操作未发送。`);
      return;
    }
    setPending(command);
    setBusy(true);
    setMissing(false);
    setError(null);
    setStatus(null);
    try {
      applied(
        FinanceSimulationCommandResultSchema.parse(await rpc.finance.simulationCommand(command)),
      );
    } catch (failure: unknown) {
      const code =
        failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (["BAD_REQUEST", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(code)) {
        clearIntent();
        setPending(null);
        setError(errorText(failure, t`操作未应用，请刷新后再试`));
      } else setError(t`尚未确认操作结果，请先查询；重试会保留原操作编号。`);
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const value = await rpc.finance.simulationCommandStatus({
        commandType: pending.commandType,
        idempotencyKey: pending.idempotencyKey,
      });
      if (value) applied(FinanceSimulationCommandResultSchema.parse(value));
      else {
        setMissing(true);
        setStatus(t`暂未查到结果，可以重试同一操作。`);
      }
    } catch (failure: unknown) {
      setError(errorText(failure, t`暂时无法查询，请稍后再查`));
    } finally {
      setBusy(false);
    }
  }
  function create(event: FormEvent) {
    event.preventDefault();
    if (inactive || !canCreate || !selectedRule) return;
    const command = FinanceSimulationCommandSchema.safeParse({
      commandType: "simulation.create",
      idempotencyKey: `simulation:${newClientId()}`,
      name: name.trim(),
      market: selectedRule.market,
      mode,
      symbols:
        ruleId === "crypto_btc_hold"
          ? ["BTCUSDT"]
          : [
              ...new Set(
                symbols
                  .split(/[,，\n]/)
                  .map((symbol) => symbol.trim())
                  .filter(Boolean),
              ),
            ],
      ruleId,
      initialCash: cash.trim(),
      commissionRate: commission.trim(),
      slippageRate: slippage.trim(),
      sellTaxRate: selectedRule.market === "crypto" ? "0" : sellTax.trim(),
      ...(mode === "backtest" ? { startDate, endDate } : {}),
    });
    if (!command.success) {
      setError(
        t`请检查名称、代码、日期和资金参数。现金需为正数且不超过十亿，A 股最多 2 位小数，加密最多 8 位；各费率需在 0–0.05 之间。`,
      );
      return;
    }
    void send(command.data);
  }

  return (
    <section className="mb-8 space-y-5">
      <p className="max-w-prose text-sm leading-6 text-muted-foreground">
        <Trans>
          内置规则使用日线和模拟资金。后台服务保持运行时，关闭客户端不影响任务。规则参数和费用在创建时冻结，账本中可复查。模拟价格步长为
          A 股 0.01、加密 0.00000001，属于模拟假设。
        </Trans>
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      ) : null}
      {pending ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="break-all text-xs text-muted-foreground">
            <Trans>待确认操作</Trans> · {pending.commandType} · {pending.idempotencyKey}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void check()}>
              <Trans>查询模拟操作结果</Trans>
            </Button>
            {missing ? (
              <Button
                variant="secondary"
                disabled={busy || !catalog?.enabled || !supported.includes(pending.commandType)}
                onClick={() => void send(pending)}
              >
                <Trans>重试同一模拟操作</Trans>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {catalog?.enabled && supported.includes("simulation.create") ? (
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            <Trans>创建日线模拟</Trans>
          </summary>
          <form onSubmit={create} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="simulation-name">
                <Trans>模拟名称</Trans>
              </Label>
              <Input
                id="simulation-name"
                value={name}
                maxLength={100}
                required
                disabled={inactive}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="simulation-rule">
                <Trans>内置规则与市场</Trans>
              </Label>
              <NativeSelect
                id="simulation-rule"
                value={ruleId}
                disabled={inactive}
                onChange={(event) => setRuleId(event.target.value)}
              >
                {rules.map((rule) => (
                  <NativeSelectOption key={rule.id} value={rule.id}>
                    {rule.name} · {rule.market === "cn" ? t`A 股` : t`加密现货`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="simulation-mode">
                <Trans>运行方式</Trans>
              </Label>
              <NativeSelect
                id="simulation-mode"
                value={mode}
                disabled={inactive}
                onChange={(event) => setMode(event.target.value as typeof mode)}
              >
                <NativeSelectOption value="paper">
                  <Trans>模拟盯盘</Trans>
                </NativeSelectOption>
                <NativeSelectOption value="backtest">
                  <Trans>历史回测</Trans>
                </NativeSelectOption>
              </NativeSelect>
            </div>
            {ruleId !== "crypto_btc_hold" ? (
              <div className="space-y-2">
                <Label htmlFor="simulation-symbols">
                  <Trans>代码（逗号分隔，最多 12 个）</Trans>
                </Label>
                <Input
                  id="simulation-symbols"
                  value={symbols}
                  maxLength={780}
                  required
                  disabled={inactive}
                  placeholder="BTCUSDT, ETHUSDT"
                  onChange={(event) => setSymbols(event.target.value)}
                />
              </div>
            ) : (
              <p className="self-center text-sm text-muted-foreground">
                <Trans>规则标的：BTCUSDT</Trans>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="simulation-cash">
                {selectedRule?.market === "cn" ? t`初始模拟资金（CNY）` : t`初始模拟资金（USDT）`}
              </Label>
              <Input
                id="simulation-cash"
                value={cash}
                maxLength={80}
                inputMode="decimal"
                required
                disabled={inactive}
                onChange={(event) => setCash(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="simulation-commission">
                <Trans>手续费率（0.001 = 0.1%）</Trans>
              </Label>
              <Input
                id="simulation-commission"
                value={commission}
                maxLength={80}
                inputMode="decimal"
                required
                disabled={inactive}
                onChange={(event) => setCommission(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="simulation-slippage">
                <Trans>滑点率（0.0005 = 0.05%）</Trans>
              </Label>
              <Input
                id="simulation-slippage"
                value={slippage}
                maxLength={80}
                inputMode="decimal"
                required
                disabled={inactive}
                onChange={(event) => setSlippage(event.target.value)}
              />
            </div>
            {selectedRule?.market === "cn" ? (
              <div className="space-y-2">
                <Label htmlFor="simulation-sell-tax">
                  <Trans>卖出税率（模拟假设，0–0.05）</Trans>
                </Label>
                <Input
                  id="simulation-sell-tax"
                  value={sellTax}
                  maxLength={80}
                  inputMode="decimal"
                  required
                  disabled={inactive}
                  onChange={(event) => setSellTax(event.target.value)}
                />
              </div>
            ) : null}
            {mode === "backtest"
              ? (
                  [
                    ["start", t`开始日期`, startDate, setStartDate],
                    ["end", t`结束日期`, endDate, setEndDate],
                  ] as const
                ).map(([key, label, value, setValue]) => (
                  <div className="space-y-2" key={key}>
                    <Label htmlFor={`simulation-${key}`}>{label}</Label>
                    <Input
                      id={`simulation-${key}`}
                      type="date"
                      required
                      value={value}
                      disabled={inactive}
                      onChange={(event) => setValue(event.target.value)}
                    />
                  </div>
                ))
              : null}
            <Button
              className="w-fit sm:col-span-2"
              type="submit"
              disabled={inactive || !canCreate || !name.trim() || !cash.trim()}
            >
              <Trans>创建模拟账户</Trans>
            </Button>
          </form>
        </details>
      ) : (
        <p className="text-xs text-muted-foreground">
          <Trans>新建模拟暂未开放；已有记录和可用操作仍可查看。</Trans>
        </p>
      )}
      {catalog?.rules
        .filter((rule) => !rule.available)
        .map((rule) => (
          <p key={rule.id} className="text-xs text-muted-foreground">
            {rule.name} ·{" "}
            {rule.reason === "simulation_disabled"
              ? t`尚未启用`
              : rule.reason === "simulation_dependency_unavailable"
                ? t`需要准备行情与运行依赖`
                : rule.reason === "simulation_market_unverified"
                  ? t`市场规则尚未验证`
                  : t`暂不可用`}
          </p>
        ))}
      {catalog?.enabled
        ? data.runs
            .filter(
              (run) =>
                run.ledgerPrecision === "decimal_v1" &&
                catalog.markets.includes(run.market as "cn" | "crypto"),
            )
            .map((run) => {
              const actions =
                run.status === "ready"
                  ? run.mode === "paper"
                    ? ["simulation.start", "simulation.stop"]
                    : ["simulation.run", "simulation.stop"]
                  : run.status === "running"
                    ? run.mode === "paper"
                      ? ["simulation.pause", "simulation.stop"]
                      : ["simulation.stop"]
                    : run.status === "paused" && run.mode === "paper"
                      ? ["simulation.resume", "simulation.stop"]
                      : [];
              const labels: Record<string, string> = {
                "simulation.start": t`启动模拟`,
                "simulation.pause": t`暂停模拟`,
                "simulation.resume": t`继续模拟`,
                "simulation.stop": t`终止模拟`,
                "simulation.run": t`开始回测`,
              };
              return actions.some((action) => supported.includes(action)) ? (
                <div
                  key={run.id}
                  className="flex flex-wrap items-center gap-3 border-b border-border pb-4"
                >
                  <p className="flex-1 text-sm font-medium">{run.name}</p>
                  {actions
                    .filter((action) => supported.includes(action))
                    .map((action) => (
                      <Button
                        key={action}
                        variant="secondary"
                        disabled={inactive}
                        onClick={() =>
                          void send(
                            FinanceSimulationCommandSchema.parse({
                              commandType: action,
                              idempotencyKey: `simulation:${newClientId()}`,
                              runId: run.id,
                              expectedRevision: run.revision,
                            }),
                          )
                        }
                      >
                        {labels[action]}
                      </Button>
                    ))}
                  <p className="basis-full text-xs text-muted-foreground">
                    <Trans>终止后不能继续，需要新建模拟账户。</Trans>
                  </p>
                </div>
              ) : null;
            })
        : null}
    </section>
  );
}
