import { Trans, useLingui } from "@lingui/react/macro";
import type {
  FinanceResearchCommand,
  FinanceResearchOverview,
  FinanceResearchRequest,
} from "@marketbot/contracts";
import {
  FinanceResearchCommandSchema,
  FinanceResearchOverviewSchema,
  FinanceResearchRequestSchema,
} from "@marketbot/contracts";
import { Button, Input, Label, NativeSelect, NativeSelectOption } from "@marketbot/ui-web";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { newClientId } from "../../lib/client-id";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { ObservationPanel } from "./ObservationPanel";

export function ResearchPanel({ userId }: { userId?: string }) {
  return <UserResearchPanel key={userId ?? "anonymous"} userId={userId} />;
}

function UserResearchPanel({ userId }: { userId?: string }) {
  const { t } = useLingui();
  const storageKey = userId ? `finance:research-intent:${userId}` : null;
  const [data, setData] = useState<FinanceResearchOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<FinanceResearchCommand | null>(() => {
    try {
      const saved = storageKey ? sessionStorage.getItem(storageKey) : null;
      return saved ? FinanceResearchCommandSchema.parse(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });
  const [missing, setMissing] = useState(false);
  const [kind, setKind] = useState<"research.create" | "screening.create">("research.create");
  const [market, setMarket] = useState<"cn" | "crypto">("cn");
  const [symbol, setSymbol] = useState("");
  const [strategy, setStrategy] = useState("");
  const [maxResults, setMaxResults] = useState("10");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const value = FinanceResearchOverviewSchema.parse(await rpc.finance.researchOverview({}));
        if (!stopped) {
          setData(value);
          setError(null);
        }
      } catch (failure: unknown) {
        if (!stopped) setError(errorText(failure, t`研究状态暂时不可用，已有结果仍保留。`));
      }
    };
    void load();
    // The browser observes durable tasks; it never advances research itself.
    const timer = setInterval(() => void load(), 15_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [refresh, t]);

  function accept(raw: FinanceResearchRequest) {
    const task = FinanceResearchRequestSchema.parse(raw);
    try {
      if (storageKey) sessionStorage.removeItem(storageKey);
    } catch {
      /* Querying the completed key remains safe. */
    }
    setPending(null);
    setMissing(false);
    setError(null);
    setData((previous) =>
      previous
        ? {
            ...previous,
            requests: [task, ...previous.requests.filter((item) => item.id !== task.id)].slice(
              0,
              50,
            ),
          }
        : previous,
    );
    setRefresh((value) => value + 1);
  }
  async function send(command: FinanceResearchCommand) {
    if (!storageKey) {
      setError(t`账户信息尚未准备好，研究未发送。`);
      return;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(command));
    } catch {
      setError(t`无法保存操作编号，研究未发送。`);
      return;
    }
    setPending(command);
    setMissing(false);
    setBusy(true);
    setError(null);
    try {
      accept(await rpc.finance.researchCommand(command));
    } catch (failure: unknown) {
      const code =
        failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (
        [
          "BAD_REQUEST",
          "CONFLICT",
          "FORBIDDEN",
          "NOT_FOUND",
          "UNAUTHORIZED",
          "TOO_MANY_REQUESTS",
        ].includes(code)
      ) {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* The saved key can be queried. */
        }
        setPending(null);
        setError(errorText(failure, t`研究未创建，请检查输入与额度。`));
        setRefresh((value) => value + 1);
      } else setError(t`尚未确认研究结果，请先查询原操作，再决定是否重试。`);
    } finally {
      setBusy(false);
    }
  }
  async function query() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await rpc.finance.researchCommandStatus({
        commandType: pending.commandType,
        idempotencyKey: pending.idempotencyKey,
      });
      if (result) accept(result);
      else {
        setMissing(true);
        setError(t`暂未查到任务，可以使用原操作编号重试。`);
      }
    } catch (failure: unknown) {
      setError(errorText(failure, t`暂时无法查询，请稍后重试。`));
    } finally {
      setBusy(false);
    }
  }
  function create(event: FormEvent) {
    event.preventDefault();
    const value =
      kind === "research.create"
        ? {
            commandType: kind,
            idempotencyKey: newClientId(),
            market,
            symbol: symbol.trim(),
            reportType: "detailed",
          }
        : {
            commandType: kind,
            idempotencyKey: newClientId(),
            market,
            strategy: strategy.trim(),
            maxResults: Number(maxResults),
          };
    const parsed = FinanceResearchCommandSchema.safeParse(value);
    if (!parsed.success) {
      setError(t`请检查标的或筛选策略，候选数量应为 1–30。`);
      return;
    }
    void send(parsed.data);
  }
  const disabled =
    busy || !!pending || !storageKey || !data?.capabilities.enabled || data.usage.blocked;
  const reason = data?.capabilities.reason;
  const unavailable =
    reason === "research_model_unconfigured"
      ? t`尚未配置研究模型`
      : reason === "research_dependencies_missing"
        ? t`研究服务尚未准备好`
        : t`研究服务尚未启用`;
  const states = {
    queued: t`等待执行`,
    running: t`研究中`,
    succeeded: t`已完成`,
    failed: t`失败`,
    interrupted: t`执行中断`,
  };

  return (
    <section className="space-y-6" aria-label={t`创建研究与条件筛选`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">
            <Trans>研究与选股</Trans>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <Trans>研究记录保留实际输出、用量和失败原因。保存观点不会自动启动交易。</Trans>
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <Trans>刷新研究状态</Trans>
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {data ? (
        <>
          <dl className="grid gap-x-6 gap-y-3 border-y border-border py-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">
                <Trans>今日额度（UTC）</Trans> · {data.usage.day}
              </dt>
              <dd className="mt-1 tabular-nums">
                {data.usage.committedTokens} / {data.usage.tokenLimit} tokens
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                <Trans>已核实 / 待核实预留</Trans>
              </dt>
              <dd className="mt-1 tabular-nums">
                {data.usage.verifiedTokens} / {data.usage.unverifiedReservedTokens} tokens
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                <Trans>模型费用</Trans>
              </dt>
              <dd className="mt-1">
                <Trans>价格未知 · 仅统计用量</Trans>
              </dd>
            </div>
          </dl>
          {!data.capabilities.enabled ? (
            <p className="text-sm text-muted-foreground">
              {unavailable}。<Trans>已有研究仍可查看，准备好后才能创建新任务。</Trans>
            </p>
          ) : null}
          {data.usage.blocked ? (
            <p role="status" className="text-sm text-destructive">
              <Trans>今日预算已阻断新模型调用。已保存的输出仍可查看。</Trans>
            </p>
          ) : null}
          {pending ? (
            <div className="space-y-3 border border-border rounded-lg p-4">
              <p className="break-all text-xs text-muted-foreground">
                <Trans>待确认操作</Trans> · {pending.idempotencyKey}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => void query()}>
                  <Trans>查询研究操作结果</Trans>
                </Button>
                {missing ? (
                  <Button
                    variant="secondary"
                    disabled={busy || !data.capabilities.enabled || data.usage.blocked}
                    onClick={() => void send(pending)}
                  >
                    <Trans>重试同一研究操作</Trans>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="research-kind">
                <Trans>任务</Trans>
              </Label>
              <NativeSelect
                id="research-kind"
                value={kind}
                disabled={busy || !!pending}
                onChange={(event) => setKind(event.target.value as typeof kind)}
              >
                <NativeSelectOption value="research.create">
                  <Trans>分析单个标的</Trans>
                </NativeSelectOption>
                <NativeSelectOption value="screening.create">
                  <Trans>条件筛选</Trans>
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="research-market">
                <Trans>市场</Trans>
              </Label>
              <NativeSelect
                id="research-market"
                value={market}
                disabled={disabled}
                onChange={(event) => setMarket(event.target.value as typeof market)}
              >
                <NativeSelectOption value="cn">
                  <Trans>A 股</Trans>
                </NativeSelectOption>
                <NativeSelectOption value="crypto">
                  <Trans>加密现货</Trans>
                </NativeSelectOption>
              </NativeSelect>
            </div>
            {kind === "research.create" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="research-symbol">
                  <Trans>股票代码或交易对</Trans>
                </Label>
                <Input
                  id="research-symbol"
                  value={symbol}
                  maxLength={32}
                  required
                  disabled={disabled}
                  onChange={(event) => setSymbol(event.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="research-strategy">
                    <Trans>已有筛选策略标识</Trans>
                  </Label>
                  <Input
                    id="research-strategy"
                    value={strategy}
                    maxLength={64}
                    required
                    disabled={disabled}
                    onChange={(event) => setStrategy(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    <Trans>使用金融服务已提供的筛选条件，未知策略不会产生候选。</Trans>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="research-limit">
                    <Trans>最多候选数</Trans>
                  </Label>
                  <Input
                    id="research-limit"
                    type="number"
                    min={1}
                    max={30}
                    value={maxResults}
                    required
                    disabled={disabled}
                    onChange={(event) => setMaxResults(event.target.value)}
                  />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={disabled}>
                <Trans>创建研究任务</Trans>
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                <Trans>每次任务有独立用量上限；费用未知时不显示估算价格。</Trans>
              </p>
            </div>
          </form>
          <div className="space-y-3">
            <h3 className="font-medium">
              <Trans>研究记录</Trans>
            </h3>
            {!data.requests.length ? (
              <p className="text-sm text-muted-foreground">
                <Trans>还没有研究任务。创建任务后，可以查看进度和当时的分析结果。</Trans>
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.requests.map((task) => (
                  <details key={task.id} className="py-4">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                      <span className="break-all">
                        {String(task.request.symbol ?? task.request.strategy ?? task.id)} ·{" "}
                        {task.commandType === "research.create" ? t`标的研究` : t`条件筛选`}
                      </span>
                      <span className="text-muted-foreground">{states[task.status]}</span>
                    </summary>
                    <div className="mt-4 space-y-3 text-sm">
                      <p className="text-xs text-muted-foreground">
                        <Trans>创建</Trans> · {new Date(task.createdAt).toLocaleString()} ·{" "}
                        <Trans>结果按当时信息保留</Trans>
                      </p>
                      {task.error ? (
                        <p role="status" className="break-all text-destructive">
                          <Trans>任务未完成</Trans> · {task.error.code}
                        </p>
                      ) : null}
                      {task.result ? (
                        <ResearchResult result={task.result} />
                      ) : task.status === "running" || task.status === "queued" ? (
                        <p className="text-muted-foreground">
                          <Trans>后台处理后自动更新，关闭页面不取消任务。</Trans>
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          <Trans>没有完整报告，保留已记录的状态和输出。</Trans>
                        </p>
                      )}
                      {task.modelOutputs.map((output) => (
                        <div key={output.callId} className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {output.model} · <Trans>已保存模型输出</Trans>
                            {output.output.truncated ? ` · ${t`已截断`}` : ""}
                          </p>
                          <p className="whitespace-pre-wrap break-words leading-relaxed">
                            {output.output.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
          <ObservationPanel userId={userId} tasks={data.requests} />
        </>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {error ? t`暂时无法读取研究任务，请刷新重试。` : t`正在读取研究服务…`}
        </p>
      )}
    </section>
  );
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function ResearchResult({ result }: { result: Record<string, unknown> }) {
  const { t } = useLingui();
  const report = object(result.report);
  const summary = object(report.summary);
  const detail = object(report.details);
  const sections = [
    [t`分析摘要`, summary.analysis_summary],
    [t`研究观点`, summary.operation_advice],
    [t`技术分析`, detail.technical_analysis],
    [t`基本面分析`, detail.fundamental_analysis],
    [t`相关新闻`, detail.news_summary],
    [t`风险与缺口`, detail.risk_warning],
    [t`市场判断`, result.llm_market_view],
    [t`筛选依据`, result.llm_selection_logic],
    [t`组合风险`, result.llm_portfolio_risk],
  ].filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
  );
  const candidates = Array.isArray(result.candidates) ? result.candidates.map(object) : [];
  return (
    <div className="space-y-4">
      {sections.map(([label, value]) => (
        <div key={label}>
          <h4 className="font-medium">{label}</h4>
          <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{value}</p>
        </div>
      ))}
      {candidates.length ? (
        <div>
          <h4 className="font-medium">
            <Trans>实际入选候选</Trans> · {candidates.length}
          </h4>
          <ul className="mt-2 divide-y divide-border">
            {candidates.map((candidate, index) => (
              <li key={String(candidate.code ?? candidate.symbol ?? index)} className="py-3">
                <p className="break-all">
                  {String(candidate.name ?? candidate.stock_name ?? "")} ·{" "}
                  {String(candidate.code ?? candidate.symbol ?? candidate.stock_code ?? "")}
                </p>
                {typeof candidate.reason === "string" ? (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {candidate.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">
          <Trans>查看留存的完整业务结果</Trans>
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-4 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}
