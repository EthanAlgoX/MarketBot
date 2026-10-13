import { Trans, useLingui } from "@lingui/react/macro";
import type {
  FinanceObservation,
  FinanceRuleDraft,
  FinanceRuleDraftInput,
  FinanceSimulationCatalog,
} from "@marketbot/contracts";
import {
  FinanceOverviewSchema,
  FinanceRuleDraftInputSchema,
  FinanceRuleDraftSchema,
  FinanceSimulationCatalogSchema,
  financeRuleDraftMatchesInput,
} from "@marketbot/contracts";
import { Button, Input, Label, NativeSelect, NativeSelectOption } from "@marketbot/ui-web";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { newClientId } from "../../lib/client-id";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

export function RuleDraftPanel({
  userId,
  observations,
}: {
  userId?: string;
  observations: FinanceObservation[];
}) {
  const { t } = useLingui();
  const storageKey = userId ? `finance:rule-draft-intent:${userId}` : null;
  const [items, setItems] = useState<FinanceRuleDraft[]>([]);
  const [catalog, setCatalog] = useState<FinanceSimulationCatalog | null>(null);
  const [supported, setSupported] = useState(false);
  const [pending, setPending] = useState<FinanceRuleDraftInput | null>(() => {
    try {
      const raw = storageKey ? sessionStorage.getItem(storageKey) : null;
      return raw ? FinanceRuleDraftInputSchema.parse(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  });
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [observationId, setObservationId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"paper" | "backtest">("paper");
  const [symbols, setSymbols] = useState("");
  const [cash, setCash] = useState("");
  const [commission, setCommission] = useState("0.001");
  const [slippage, setSlippage] = useState("0.0005");
  const [sellTax, setSellTax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const hasObservations = observations.length > 0;
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void rpc.finance
      .ruleDrafts({})
      .then((raw) => {
        if (!cancelled) setItems(FinanceRuleDraftSchema.array().max(100).parse(raw));
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(errorText(failure, t`无法读取规则草稿`));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, t]);
  useEffect(() => {
    let cancelled = false;
    if (!hasObservations) return;
    void Promise.all([rpc.finance.overview({}), rpc.finance.simulationCatalog({})])
      .then(([raw, rules]) => {
        if (cancelled) return;
        const overview = FinanceOverviewSchema.parse(raw);
        const next = FinanceSimulationCatalogSchema.parse(rules);
        setSupported(!!overview.data?.capabilities.supportedCommands.includes("simulation.create"));
        setCatalog(next);
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setSupported(false);
          setCatalog(null);
          setError(errorText(failure, t`规则目录暂时不可用`));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasObservations, refresh, t]);
  const rules =
    catalog?.rules.filter((rule) => rule.available && catalog.markets.includes(rule.market)) ?? [];
  const selected = rules.find((rule) => rule.id === ruleId);
  const canSave = supported && catalog?.enabled && !!selected;
  function clear() {
    try {
      if (storageKey) sessionStorage.removeItem(storageKey);
    } catch {
      /* The original key remains safe to query. */
    }
    setPending(null);
    setMissing(false);
  }
  function accept(raw: unknown, intent: FinanceRuleDraftInput) {
    const item = FinanceRuleDraftSchema.parse(raw);
    if (!financeRuleDraftMatchesInput(item, intent)) throw new Error("Draft receipt mismatch");
    clear();
    setError(null);
    setName("");
    setCash("");
    setItems((prior) => [item, ...prior.filter((value) => value.id !== item.id)].slice(0, 100));
  }
  async function send(input: FinanceRuleDraftInput) {
    if (busy || !storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(input));
    } catch {
      setError(t`无法保存操作编号，草稿未发送。`);
      return;
    }
    setBusy(true);
    setPending(input);
    setMissing(false);
    setError(null);
    try {
      accept(await rpc.finance.saveRuleDraft(input), input);
    } catch (failure: unknown) {
      const code =
        failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (["BAD_REQUEST", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(code)) {
        clear();
        setError(errorText(failure, t`草稿未保存，请检查观察记录与规则目录。`));
      } else setError(t`保存结果尚未确认，请先查询原操作。`);
    } finally {
      setBusy(false);
    }
  }
  async function query() {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      const item = await rpc.finance.ruleDraftStatus({ idempotencyKey: pending.idempotencyKey });
      if (item) accept(item, pending);
      else setMissing(true);
    } catch (failure: unknown) {
      setError(errorText(failure, t`无法查询草稿保存结果`));
    } finally {
      setBusy(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!canSave || busy || pending || !selected) return;
    const checked = FinanceRuleDraftInputSchema.safeParse({
      observationId,
      idempotencyKey: `rule-draft:${newClientId()}`,
      configuration: {
        name,
        market: selected.market,
        mode,
        ruleId: selected.id,
        symbols:
          selected.id === "crypto_btc_hold"
            ? ["BTCUSDT"]
            : [
                ...new Set(
                  symbols
                    .split(/[,，\n]/)
                    .map((symbol) => symbol.trim())
                    .filter(Boolean),
                ),
              ],
        initialCash: cash.trim(),
        commissionRate: commission.trim(),
        slippageRate: slippage.trim(),
        sellTaxRate: selected.market === "crypto" ? "0" : sellTax.trim(),
        ...(mode === "backtest" ? { startDate, endDate } : {}),
      },
    });
    if (!checked.success || !observations.some((item) => item.id === observationId)) {
      setError(t`请选择原观察记录并填写有效的模拟配置。`);
      return;
    }
    void send(checked.data);
  }
  async function copy(item: FinanceRuleDraft) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(item.configuration, null, 2));
      setCopied(item.id);
    } catch {
      setError(t`无法访问剪贴板，可以从配置详情手动复制。`);
    }
  }
  const disabled = busy || !!pending || !storageKey;
  return (
    <section className="space-y-4 border-t border-border pt-6" aria-label={t`规则草稿`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">
          <Trans>规则草稿</Trans>
        </h3>
        <Button
          variant="secondary"
          disabled={loading || busy}
          onClick={() => {
            setError(null);
            setRefresh((value) => value + 1);
          }}
        >
          <Trans>刷新规则草稿</Trans>
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {pending ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="break-all text-xs text-muted-foreground">
            <Trans>待确认草稿</Trans> · {pending.idempotencyKey}
          </p>
          <p className="text-sm">{pending.configuration.name}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void query()}>
              <Trans>查询草稿保存结果</Trans>
            </Button>
            {missing ? (
              <Button variant="secondary" disabled={busy} onClick={() => void send(pending)}>
                <Trans>重试同一规则草稿</Trans>
              </Button>
            ) : null}
          </div>
        </div>
      ) : hasObservations && supported && catalog?.enabled && rules.length ? (
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            <Trans>记录规则草稿</Trans>
          </summary>
          <p className="mt-3 text-xs text-muted-foreground">
            <Trans>
              手动选择内置规则并保存配置；不会运行模拟。规则版本在以后创建模拟时才冻结。
            </Trans>
          </p>
          <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="draft-observation">
                <Trans>原观察记录</Trans>
              </Label>
              <NativeSelect
                id="draft-observation"
                value={observationId}
                disabled={disabled}
                required
                onChange={(event) => setObservationId(event.target.value)}
              >
                <NativeSelectOption value="">
                  <Trans>选择观察记录</Trans>
                </NativeSelectOption>
                {observations.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.note.slice(0, 60)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-rule">
                <Trans>可用内置规则</Trans>
              </Label>
              <NativeSelect
                id="draft-rule"
                value={ruleId}
                disabled={disabled}
                required
                onChange={(event) => setRuleId(event.target.value)}
              >
                <NativeSelectOption value="">
                  <Trans>选择规则</Trans>
                </NativeSelectOption>
                {rules.map((rule) => (
                  <NativeSelectOption key={rule.id} value={rule.id}>
                    {rule.name} · {rule.market.toUpperCase()}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-name">
                <Trans>草稿名称</Trans>
              </Label>
              <Input
                id="draft-name"
                value={name}
                maxLength={100}
                required
                disabled={disabled}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-mode">
                <Trans>模拟方式</Trans>
              </Label>
              <NativeSelect
                id="draft-mode"
                value={mode}
                disabled={disabled}
                onChange={(event) => setMode(event.target.value as "paper" | "backtest")}
              >
                <NativeSelectOption value="paper">
                  <Trans>日线模拟盯盘</Trans>
                </NativeSelectOption>
                <NativeSelectOption value="backtest">
                  <Trans>日线回测</Trans>
                </NativeSelectOption>
              </NativeSelect>
            </div>
            {selected?.id === "crypto_btc_hold" ? (
              <p className="text-sm sm:col-span-2">BTCUSDT</p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="draft-symbols">
                  <Trans>标的代码（逗号分隔）</Trans>
                </Label>
                <Input
                  id="draft-symbols"
                  value={symbols}
                  disabled={disabled}
                  required
                  maxLength={780}
                  onChange={(event) => setSymbols(event.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="draft-cash">
                <Trans>模拟初始现金</Trans>
              </Label>
              <Input
                id="draft-cash"
                value={cash}
                disabled={disabled}
                required
                inputMode="decimal"
                maxLength={80}
                onChange={(event) => setCash(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-commission">
                <Trans>佣金比例</Trans>
              </Label>
              <Input
                id="draft-commission"
                value={commission}
                disabled={disabled}
                required
                inputMode="decimal"
                maxLength={80}
                onChange={(event) => setCommission(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-slippage">
                <Trans>滑点比例</Trans>
              </Label>
              <Input
                id="draft-slippage"
                value={slippage}
                disabled={disabled}
                required
                inputMode="decimal"
                maxLength={80}
                onChange={(event) => setSlippage(event.target.value)}
              />
            </div>
            {selected?.market === "cn" ? (
              <div className="space-y-2">
                <Label htmlFor="draft-tax">
                  <Trans>卖出税率假设</Trans>
                </Label>
                <Input
                  id="draft-tax"
                  value={sellTax}
                  disabled={disabled}
                  required
                  inputMode="decimal"
                  maxLength={80}
                  onChange={(event) => setSellTax(event.target.value)}
                />
              </div>
            ) : null}
            {mode === "backtest" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="draft-start">
                    <Trans>回测开始日期</Trans>
                  </Label>
                  <Input
                    id="draft-start"
                    type="date"
                    value={startDate}
                    disabled={disabled}
                    required
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draft-end">
                    <Trans>回测结束日期</Trans>
                  </Label>
                  <Input
                    id="draft-end"
                    type="date"
                    value={endDate}
                    disabled={disabled}
                    required
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </>
            ) : null}
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={disabled || !canSave || !observationId || !name.trim() || !cash.trim()}
              >
                <Trans>只保存规则草稿</Trans>
              </Button>
            </div>
          </form>
        </details>
      ) : (
        <p className="text-sm text-muted-foreground">
          {hasObservations
            ? t`规则目录尚未开放；已有草稿仍可查看。`
            : t`保存真实研究的观察记录后，可为可用内置规则记录草稿。`}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          <Trans>正在读取规则草稿…</Trans>
        </p>
      ) : null}
      {items.map((item) => (
        <article key={item.id} className="space-y-3 border-t border-border py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-medium">{item.configuration.name}</h4>
            <Button variant="secondary" onClick={() => void copy(item)}>
              {copied === item.id ? t`配置已复制` : t`复制配置`}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <Trans>未运行草稿</Trans> · {item.rule.name} ·{" "}
            {new Date(item.createdAt).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            <Trans>配置已保存；规则版本尚未冻结，不代表研究建议可以直接执行。</Trans>
          </p>
          <details>
            <summary className="cursor-pointer text-sm">
              <Trans>配置与原研究快照</Trans>
            </summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs">
              {JSON.stringify(
                { configuration: item.configuration, researchSnapshot: item.researchSnapshot },
                null,
                2,
              )}
            </pre>
          </details>
          <p className="break-all text-xs text-muted-foreground">
            <Trans>原观察</Trans> · {item.observationId} · <Trans>原研究</Trans> · {item.requestId}
          </p>
          <p className="break-all text-xs text-muted-foreground">
            SHA-256 · {item.researchSnapshotDigest}
          </p>
        </article>
      ))}
    </section>
  );
}
