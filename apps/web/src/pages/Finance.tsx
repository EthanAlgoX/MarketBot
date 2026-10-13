import { Trans, useLingui } from "@lingui/react/macro";
import type {
  FinanceAccount,
  FinanceNotification,
  FinanceOverview,
  FinanceReport,
  FinanceRun,
  FinanceRunDetail,
  FinanceSimulationCommandResult,
  FinanceWatchlistCommandResult,
  FinanceWorkspaceOverview,
} from "@marketbot/contracts";
import {
  FinanceNotificationsSchema,
  FinanceOverviewSchema,
  FinanceRunDetailSchema,
} from "@marketbot/contracts";
import { Badge, Button, Skeleton } from "@marketbot/ui-web";
import { ArrowLeft, ChevronDown, CircleAlert, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { IntelligencePanel } from "./finance/IntelligencePanel";
import { ManualPortfolio } from "./finance/ManualPortfolio";
import { ResearchPanel } from "./finance/ResearchPanel";
import { RunInputs } from "./finance/RunInputs";
import { SimulationControls } from "./finance/SimulationControls";
import { Watchlist } from "./finance/Watchlist";
import { WindowChrome } from "./WindowChrome";

/* Operate: a financial reading desk within MarketBot's established token system.
 * The first view exposes watched assets, dated research and simulation state.
 * No fabricated holdings, return charts or live trading controls enter this surface. */
type Section = "overview" | "portfolio" | "research" | "simulation" | "health" | "intelligence";

export function FinancePage({ userId }: { userId?: string }) {
  return <FinanceWorkspace key={userId ?? "unidentified"} userId={userId} />;
}

function FinanceWorkspace({ userId }: { userId?: string }) {
  const { t } = useLingui();
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("overview");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void rpc.finance
      .overview({})
      .then((value) => {
        if (!cancelled) setOverview(FinanceOverviewSchema.parse(value));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorText(error, t`无法加载金融工作台`));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry, t]);

  const tabs: Array<{ id: Section; label: string }> = [
    { id: "overview", label: t`总览` },
    { id: "intelligence", label: t`新闻与日报` },
    { id: "portfolio", label: t`持仓` },
    { id: "research", label: t`研究` },
    { id: "simulation", label: t`模拟策略` },
    { id: "health", label: t`服务状态` },
  ];
  const data = overview?.data;
  const simulationActive = !!data?.runs.some((run) => run.status === "running");
  useEffect(() => {
    if (!simulationActive || section !== "simulation") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setRetry((value) => value + 1);
    }, 15_000);
    return () => clearInterval(timer);
  }, [simulationActive, section]);
  function applyWatchlist(result: FinanceWatchlistCommandResult) {
    setOverview((current) =>
      current?.data
        ? {
            ...current,
            data: {
              ...current.data,
              watchlist: result.result.watchlist,
              watchlistRevision: result.result.revision,
            },
          }
        : current,
    );
  }
  function applySimulation(result: FinanceSimulationCommandResult) {
    setOverview((current) =>
      current?.data
        ? {
            ...current,
            data: {
              ...current.data,
              runs: current.data.runs.map((run) =>
                run.id === result.result.runId
                  ? {
                      ...run,
                      status: result.result.status,
                      revision: result.result.revision,
                      ledgerPrecision: result.result.ledgerPrecision,
                    }
                  : run,
              ),
            },
          }
        : current,
    );
    setRetry((value) => value + 1);
  }

  return (
    <div
      className="flex h-full min-w-0 flex-col bg-background text-foreground max-sm:[&_button]:min-h-11"
      data-testid="finance-page"
    >
      <header className="app-drag flex shrink-0 items-center justify-between border-b border-border px-4 py-3 md:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <WindowChrome />
          <Link
            to="/app"
            className="app-no-drag inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <Trans>助手</Trans>
          </Link>
          <h1 className="truncate text-lg font-semibold">
            <Trans>金融工作台</Trans>
          </h1>
        </div>
        <Button
          variant="ghost"
          className="app-no-drag"
          disabled={loading}
          onClick={() => setRetry((value) => value + 1)}
          aria-label={t`刷新金融数据`}
        >
          <RefreshCw size={16} aria-hidden="true" />
          <span className="hidden sm:inline">
            <Trans>刷新</Trans>
          </span>
        </Button>
      </header>
      <nav
        aria-label={t`金融工作台导航`}
        className="shrink-0 overflow-x-auto border-b border-border px-4 md:px-8"
      >
        <div className="flex w-max gap-1 py-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={section === tab.id ? "secondary" : "ghost"}
              aria-pressed={section === tab.id}
              onClick={() => setSection(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </nav>
      <main
        className="rk-scroll flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8"
        aria-busy={loading}
      >
        <div className="mx-auto max-w-6xl">
          {loadError && section !== "intelligence" ? (
            <div
              role="alert"
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-card p-4"
            >
              <p className="text-sm text-destructive">{loadError}</p>
              <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>
                <Trans>重试</Trans>
              </Button>
            </div>
          ) : null}
          {loading && !data && section !== "intelligence" ? <FinanceLoading /> : null}
          {section === "intelligence" ? <IntelligencePanel /> : null}
          {!loading && overview && !data && section !== "intelligence" ? (
            <ConnectionState overview={overview} onConnected={setOverview} />
          ) : null}
          {data ? (
            <>
              <div
                className={`mb-8 flex flex-wrap items-center gap-3 text-xs text-muted-foreground ${section === "intelligence" ? "hidden" : ""}`}
              >
                {data.capabilities.readOnly ? (
                  <Badge variant="outline">
                    <Trans>只读</Trans>
                  </Badge>
                ) : null}
                <span>
                  <Trans>日线模拟</Trans>
                </span>
                <span>
                  <Trans>读取时间</Trans> {time(data.asOf)}
                </span>
                {loading || loadError ? (
                  <span role="status">
                    <Trans>当前显示上次读取结果</Trans>
                  </span>
                ) : null}
              </div>
              {section === "overview" ? (
                <Overview
                  data={data}
                  onSelect={setSection}
                  onWatchlistChanged={applyWatchlist}
                  onRefresh={() => setRetry((value) => value + 1)}
                  userId={userId}
                />
              ) : null}
              {section === "portfolio" ? (
                <>
                  <Portfolio accounts={data.portfolio.accounts} />
                  {data.capabilities.supportedCommands.some((command) =>
                    command.startsWith("portfolio."),
                  ) ? (
                    <ManualPortfolio
                      userId={userId}
                      refreshKey={retry}
                      onChanged={() => setRetry((value) => value + 1)}
                    />
                  ) : null}
                </>
              ) : null}
              {section === "research" ? (
                <>
                  <ResearchPanel userId={userId} />
                  <div className="mt-8">
                    <Research reports={data.reports} />
                  </div>
                </>
              ) : null}
              {section === "simulation" ? (
                <>
                  {simulationActive ? (
                    <p className="mb-4 text-xs text-muted-foreground">
                      <Trans>模拟任务进行中，每 15 秒刷新状态。</Trans>
                    </p>
                  ) : null}
                  <SimulationControls
                    data={data}
                    userId={userId}
                    refreshKey={retry}
                    onApplied={applySimulation}
                  />
                  <Simulations runs={data.runs} />
                </>
              ) : null}
              {section === "health" ? <ServiceHealth data={data} /> : null}
            </>
          ) : null}
          {section === "overview" ? <FinanceNotifications refreshKey={retry} /> : null}
        </div>
      </main>
    </div>
  );
}

function FinanceLoading() {
  return (
    <div className="space-y-7" role="status">
      <span className="sr-only">
        <Trans>正在读取金融数据</Trans>
      </span>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function ConnectionState({
  overview,
  onConnected,
}: {
  overview: FinanceOverview;
  onConnected: (value: FinanceOverview) => void;
}) {
  const { t } = useLingui();
  const [owner, setOwner] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (overview.availability === "unbound") {
      void rpc
        .me()
        .then((value) => {
          if (!cancelled) setOwner(value.isDeploymentOwner);
        })
        .catch(() => {
          if (!cancelled) setOwner(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [overview.availability]);
  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      onConnected(FinanceOverviewSchema.parse(await rpc.finance.connect({})));
    } catch (failure: unknown) {
      setError(errorText(failure, t`无法创建金融工作区`));
    } finally {
      setConnecting(false);
    }
  }
  const title =
    overview.availability === "unconfigured" ? (
      <Trans>金融服务尚未连接</Trans>
    ) : overview.availability === "unbound" ? (
      <Trans>金融工作区尚未绑定</Trans>
    ) : (
      <Trans>金融服务暂时无法读取</Trans>
    );
  return (
    <section className="max-w-xl py-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {overview.message ?? (
          <Trans>完成服务配置后，可在这里查看自选、持仓、研究和模拟策略。</Trans>
        )}
      </p>
      {overview.availability === "unbound" ? (
        owner ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              <Trans>创建你的独立金融工作区后，可以添加自选。现有金融数据不会自动导入。</Trans>
            </p>
            <Button disabled={connecting} onClick={() => void connect()}>
              <Trans>创建金融工作区</Trans>
            </Button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">
            <Trans>请等待部署管理员为此账户绑定金融工作区。</Trans>
          </p>
        )
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Overview({
  data,
  onSelect,
  onWatchlistChanged,
  onRefresh,
  userId,
}: {
  data: FinanceWorkspaceOverview;
  onSelect: (section: Section) => void;
  onWatchlistChanged: (result: FinanceWatchlistCommandResult) => void;
  onRefresh: () => void;
  userId?: string;
}) {
  return (
    <div className="space-y-10">
      <Watchlist data={data} onChanged={onWatchlistChanged} onRefresh={onRefresh} userId={userId} />
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            <Trans>最新研究</Trans>
          </h2>
          <Button variant="ghost" onClick={() => onSelect("research")}>
            <Trans>查看全部</Trans>
          </Button>
        </div>
        <Research reports={data.reports.slice(0, 3)} compact />
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            <Trans>模拟策略</Trans>
          </h2>
          <Button variant="ghost" onClick={() => onSelect("simulation")}>
            <Trans>查看运行</Trans>
          </Button>
        </div>
        {data.runs.length ? (
          <div className="divide-y divide-border border-y border-border">
            {data.runs.slice(0, 3).map((run) => (
              <RunSummary key={run.id} run={run} />
            ))}
          </div>
        ) : (
          <Empty>
            <Trans>尚无模拟运行。已有金融引擎中的日线账户会显示在这里。</Trans>
          </Empty>
        )}
      </section>
    </div>
  );
}

function Portfolio({ accounts }: { accounts: FinanceAccount[] }) {
  return (
    <section>
      <h2 className="mb-5 text-base font-semibold">
        <Trans>账户与持仓</Trans>
      </h2>
      {accounts.length ? (
        <div className="space-y-10">
          {accounts.map((account) => (
            <article key={account.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h3 className="font-medium">{account.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {account.market.toUpperCase()} · {account.currency} · <Trans>快照</Trans>{" "}
                    {account.snapshotDate ?? "—"}
                  </p>
                </div>
                <Quality quality={account.quality} />
              </div>
              <dl className="my-5 flex flex-wrap gap-x-10 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">
                    <Trans>权益</Trans>
                  </dt>
                  <dd className="mt-1 tabular-nums">
                    {amount(account.equity)} {account.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    <Trans>现金</Trans>
                  </dt>
                  <dd className="mt-1 tabular-nums">
                    {amount(account.cash)} {account.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    <Trans>持仓市值</Trans>
                  </dt>
                  <dd className="mt-1 tabular-nums">
                    {amount(account.marketValue)} {account.currency}
                  </dd>
                </div>
              </dl>
              {account.positions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-xl text-sm">
                    <thead className="border-y border-border text-xs text-muted-foreground">
                      <tr>
                        <th className="py-3 text-start font-medium">
                          <Trans>标的</Trans>
                        </th>
                        <th className="py-3 text-end font-medium">
                          <Trans>数量</Trans>
                        </th>
                        <th className="py-3 text-end font-medium">
                          <Trans>成本</Trans>
                        </th>
                        <th className="py-3 text-end font-medium">
                          <Trans>最新价</Trans>
                        </th>
                        <th className="py-3 text-end font-medium">
                          <Trans>市值</Trans> ({account.currency})
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {account.positions.map((position) => (
                        <tr key={position.assetId}>
                          <td className="py-4 font-medium">
                            {position.symbol}
                            <span className="ms-2 text-xs text-muted-foreground">
                              {position.currency}
                            </span>
                          </td>
                          <td className="text-end tabular-nums">{amount(position.quantity)}</td>
                          <td className="text-end tabular-nums">{amount(position.averageCost)}</td>
                          <td className="text-end tabular-nums">{amount(position.lastPrice)}</td>
                          <td className="text-end tabular-nums">{amount(position.marketValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>
                  {account.quality === "missing" || !account.snapshotDate ? (
                    <Trans>持仓快照尚不可用。手工账户的记账数量可在下方查看。</Trans>
                  ) : (
                    <Trans>该快照没有持仓记录。</Trans>
                  )}
                </Empty>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty>
          <Trans>尚未记录持仓。金融工作区的账户与快照接入后会在这里显示。</Trans>
        </Empty>
      )}
    </section>
  );
}

function Research({ reports, compact = false }: { reports: FinanceReport[]; compact?: boolean }) {
  return (
    <section>
      {!compact ? (
        <h2 className="mb-5 text-base font-semibold">
          <Trans>历史分析报告</Trans>
        </h2>
      ) : null}
      {reports.length ? (
        <div className="divide-y divide-border border-y border-border">
          {reports.map((report) => (
            <details key={report.id} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">
                    {report.name || report.symbol}
                    <span className="ms-2 text-sm font-normal text-muted-foreground">
                      {report.symbol}
                    </span>
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{time(report.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Quality quality={report.quality} />
                  <ChevronDown
                    size={16}
                    className="text-muted-foreground group-open:rotate-180"
                    aria-hidden="true"
                  />
                </div>
              </summary>
              <div className="mt-4 max-w-prose space-y-3 text-sm leading-7">
                <p className="whitespace-pre-wrap">
                  {report.summary || <Trans>该研究尚无摘要。</Trans>}
                </p>
                {report.advice ? (
                  <p className="whitespace-pre-wrap text-muted-foreground">{report.advice}</p>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <Empty>
          <Trans>还没有研究记录。金融引擎生成的单股与加密资产分析会保留在这里。</Trans>
        </Empty>
      )}
    </section>
  );
}

function RunSummary({ run }: { run: FinanceRun }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        <h3 className="font-medium">{run.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {run.market.toUpperCase()} ·{" "}
          {run.mode === "paper" ? (
            <Trans>模拟盯盘</Trans>
          ) : run.mode === "backtest" ? (
            <Trans>回测</Trans>
          ) : (
            run.mode
          )}{" "}
          ·{" "}
          {["rule", "rules"].includes(run.decisionBackend) ? (
            <Trans>规则驱动</Trans>
          ) : (
            run.decisionBackend
          )}{" "}
          · <Trans>最后交易日</Trans> {run.lastTradingDate ?? "—"}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm tabular-nums">
          {amount(run.equity)} {run.currency}
        </span>
        <Badge variant="outline">
          <RunStatus value={run.status} />
        </Badge>
      </div>
    </div>
  );
}

function RunStatus({ value }: { value: string }) {
  switch (value) {
    case "ready":
      return <Trans>待启动</Trans>;
    case "running":
      return <Trans>运行中</Trans>;
    case "paused":
      return <Trans>已暂停</Trans>;
    case "stopped":
      return <Trans>已终止</Trans>;
    case "completed":
      return <Trans>已完成</Trans>;
    case "failed":
      return <Trans>失败</Trans>;
    default:
      return value;
  }
}

function Simulations({ runs }: { runs: FinanceRun[] }) {
  const { t } = useLingui();
  const [activeRun, setActiveRun] = useState<number | null>(null);
  const [detail, setDetail] = useState<FinanceRunDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  async function openRun(runId: number) {
    const request = ++generation.current;
    setActiveRun(runId);
    setDetail(null);
    setLoadError(null);
    setBusy(true);
    try {
      const value = FinanceRunDetailSchema.parse(await rpc.finance.run({ runId }));
      if (request === generation.current) setDetail(value);
    } catch (error: unknown) {
      if (request === generation.current) setLoadError(errorText(error, t`无法读取模拟记录`));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  return (
    <section>
      <h2 className="mb-5 text-base font-semibold">
        <Trans>日线模拟</Trans>
      </h2>
      {runs.length ? (
        <div className="divide-y divide-border border-y border-border">
          {runs.map((run) => (
            <div key={run.id}>
              <RunSummary run={run} />
              <Button
                variant="ghost"
                className="mb-3"
                onClick={() => void openRun(run.id)}
                disabled={busy && activeRun === run.id}
              >
                <Trans>查看账本</Trans>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <Empty>
          <Trans>尚无模拟运行。策略运行与交易日账本由金融引擎管理。</Trans>
        </Empty>
      )}
      {busy ? (
        <div className="mt-6">
          <FinanceLoading />
        </div>
      ) : null}
      {loadError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}
      {detail ? (
        <div className="mt-8">
          <h3 className="mb-4 font-medium">
            {detail.name} · <Trans>交易日账本</Trans>
          </h3>
          <div className="mb-6 space-y-3 text-xs leading-6 text-muted-foreground">
            <p>
              <Trans>已评估交易日</Trans> {detail.evaluatedTradingDays} · <Trans>本页展示</Trans>{" "}
              {detail.displayedTradingDays}
              {detail.historyTruncated ? (
                <>
                  {" "}
                  · <Trans>历史已截断，仅展示最近记录</Trans>
                </>
              ) : null}
            </p>
            <p>
              <Trans>收益与风险统计为派生估算。</Trans>{" "}
              {detail.ledgerPrecision === "decimal_v1" ? (
                <Trans>资金和模拟成交使用十进制账本。</Trans>
              ) : (
                <Trans>这是旧版浮点账本，仅供读取复盘。</Trans>
              )}
            </p>
            <p>
              <Trans>冻结策略</Trans> · {detail.strategyRef.ruleId ?? "—"} · v
              {detail.strategyRef.version ?? "—"} · <Trans>版本引用</Trans>{" "}
              {detail.strategyRef.strategyVersionId}
            </p>
            {detail.strategyRef.digest ? (
              <p className="break-all">
                <Trans>规则摘要</Trans> {detail.strategyRef.digest}
              </p>
            ) : null}
            {detail.decimalRules ? (
              <details>
                <summary className="cursor-pointer font-medium">
                  <Trans>查看冻结规则</Trans>
                </summary>
                <pre className="mt-3 max-w-prose whitespace-pre-wrap break-words rounded-lg bg-muted p-4 text-xs">
                  {JSON.stringify(detail.decimalRules, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
          <RunMetrics metrics={detail.metrics} />
          {detail.days.length ? (
            <div className="space-y-6">
              {detail.days.map((day) => (
                <article key={day.recordId} className="border-t border-border pt-4">
                  <div className="flex justify-between gap-4 text-sm">
                    <h4 className="font-medium">{day.tradingDate}</h4>
                    <span className="tabular-nums">
                      {amount(day.equity)} {detail.currency}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <Trans>账本记录</Trans> #{day.recordId} · {time(day.recordedAt)}
                  </p>
                  {Object.keys(day.inputSources).length ? (
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      <Trans>数据来源</Trans> ·{" "}
                      {Object.entries(day.inputSources)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  <RunInputs
                    runId={detail.id}
                    recordId={day.recordId}
                    tradingDate={day.tradingDate}
                  />
                  {day.trades.length ? (
                    <ul className="mt-3 space-y-3">
                      {day.trades.map((trade, index) => (
                        <li key={`${trade.symbol}:${index}`} className="text-sm">
                          <p>
                            {trade.symbol} · {trade.side} · {trade.status} ·{" "}
                            {amount(trade.quantity)} @ {amount(trade.price)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <Trans>费用</Trans> {amount(trade.fee)} · <Trans>滑点</Trans>{" "}
                            {amount(trade.slippage)}
                            {trade.reason ? ` · ${trade.reason}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <Trans>信号交易日</Trans> {trade.signalDate ?? "—"} ·{" "}
                            <Trans>模拟订单</Trans> {trade.orderId ?? "—"} · <Trans>模拟成交</Trans>{" "}
                            {trade.fillId ?? "—"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      <Trans>该交易日没有模拟成交。</Trans>
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty>
              <Trans>尚无交易日记录。</Trans>
            </Empty>
          )}
        </div>
      ) : null}
    </section>
  );
}

function RunMetrics({ metrics }: { metrics: FinanceRunDetail["metrics"] }) {
  const { t } = useLingui();
  const labels: Record<string, string> = {
    cumulativeReturn: t`累计收益率`,
    dailyReturn: t`单日收益率`,
    annualizedReturn: t`年化收益率`,
    maxDrawdown: t`最大回撤`,
    annualizedVolatility: t`年化波动率`,
    turnover: t`换手率`,
    sharpe: t`夏普比率`,
    calmar: t`卡玛比率`,
  };
  const items = Object.entries(labels).filter(([key]) => Object.hasOwn(metrics, key));
  if (!items.length) return null;
  return (
    <div className="mb-6">
      <p className="mb-3 text-xs text-muted-foreground">
        <Trans>收益与风险统计为派生估算；样本不足的年化指标保持空值。</Trans>
      </p>
      <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 lg:grid-cols-4">
        {items.map(([key, label]) => (
          <div key={key}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm tabular-nums">
              {metrics[key] === null ? (
                <Trans>样本不足或未知</Trans>
              ) : (
                derivedMetric(metrics[key] ?? null, key !== "sharpe" && key !== "calmar")
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function derivedMetric(value: string | null, ratio: boolean) {
  if (value === null) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return `${(ratio ? number * 100 : number).toLocaleString(undefined, { maximumFractionDigits: 2 })}${ratio ? "%" : ""}`;
}

function ServiceHealth({ data }: { data: FinanceWorkspaceOverview }) {
  const pending = data.health.precisionAudit !== "passed";
  return (
    <section>
      <h2 className="mb-5 text-base font-semibold">
        <Trans>服务状态</Trans>
      </h2>
      <dl className="max-w-2xl divide-y divide-border border-y border-border text-sm">
        <HealthRow label={<Trans>连接</Trans>} value={<Trans>已连接</Trans>} />
        <HealthRow label={<Trans>读取时间</Trans>} value={time(data.asOf)} />
        <HealthRow label={<Trans>策略检查归属</Trans>} value={<Trans>金融引擎</Trans>} />
        <HealthRow label={<Trans>事件序号</Trans>} value={String(data.health.eventHighWater)} />
        {data.health.eventSync ? (
          <>
            <HealthRow
              label={<Trans>通知同步</Trans>}
              value={
                data.health.eventSync.status === "ready" ? (
                  <Trans>已同步</Trans>
                ) : data.health.eventSync.status === "pending" ? (
                  <Trans>等待同步</Trans>
                ) : data.health.eventSync.status === "recovery_required" ? (
                  <Trans>需恢复事件游标</Trans>
                ) : (
                  <Trans>暂不可用</Trans>
                )
              }
            />
            <HealthRow
              label={<Trans>已接收事件序号</Trans>}
              value={String(data.health.eventSync.cursor)}
            />
            <HealthRow
              label={<Trans>待同步事件</Trans>}
              value={String(data.health.eventSync.lag)}
            />
            <HealthRow
              label={<Trans>最近同步</Trans>}
              value={time(data.health.eventSync.updatedAt)}
            />
          </>
        ) : null}
        <HealthRow
          label={<Trans>持仓数据</Trans>}
          value={<Quality quality={data.portfolio.quality} />}
        />
        <HealthRow
          label={<Trans>历史账本精度检查</Trans>}
          value={
            data.health.precisionAudit === "failed" ? (
              <Trans>验证失败</Trans>
            ) : pending ? (
              <Trans>待验证</Trans>
            ) : (
              <Trans>已通过</Trans>
            )
          }
        />
      </dl>
      {pending ? (
        <p className="mt-5 max-w-prose text-sm leading-6 text-muted-foreground">
          <Trans>
            历史账本精度尚未通过验证，保留读取用于复盘。新模拟账户的可用操作以规则目录和服务能力为准。
          </Trans>
        </p>
      ) : null}
      {data.health.warnings
        ?.filter((warning) => warning !== "legacy_float_storage")
        .map((warning) => (
          <p key={warning} className="mt-3 flex items-start gap-2 text-sm text-foreground">
            <CircleAlert size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            {warning === "legacy_report_timezone_unknown" ? (
              <Trans>部分历史分析报告未记录时区，请结合原始报告核对日期。</Trans>
            ) : (
              <Trans>服务有待处理的数据质量提示，请检查连接与原始记录。</Trans>
            )}
          </p>
        ))}
    </section>
  );
}

function FinanceNotifications({ refreshKey }: { refreshKey: number }) {
  const { t } = useLingui();
  const [items, setItems] = useState<FinanceNotification[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    void rpc.finance
      .notifications({})
      .then((value) => {
        if (!cancelled) setItems(FinanceNotificationsSchema.parse(value).items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorText(error, t`无法读取金融通知`));
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, t]);
  async function markRead(id: string) {
    setReading(id);
    setLoadError(null);
    try {
      await rpc.finance.markRead({ id });
      const updated = await rpc.finance.notifications({});
      setItems(FinanceNotificationsSchema.parse(updated).items);
    } catch (error: unknown) {
      setLoadError(errorText(error, t`未能保存已读状态`));
    } finally {
      setReading(null);
    }
  }
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-base font-semibold">
        <Trans>金融通知</Trans>
      </h2>
      {loadError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}
      {items?.length ? (
        <ul className="divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{item.title}</h3>
                  {item.kind === "integration.test" ? (
                    <Badge variant="outline">
                      <Trans>集成测试</Trans>
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {item.body}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{time(item.recordedAt)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <Trans>设备推送</Trans> · <PushStatus value={item.pushStatus} /> ·{" "}
                  <Trans>尝试次数</Trans> {item.pushAttempts}
                  {item.lastPushAt ? ` · ${time(item.lastPushAt)}` : ""}
                </p>
              </div>
              {item.readAt ? (
                <span className="pt-2 text-xs text-muted-foreground">
                  <Trans>已读</Trans>
                </span>
              ) : (
                <Button
                  variant="secondary"
                  disabled={reading !== null}
                  onClick={() => void markRead(item.id)}
                >
                  <Trans>标为已读</Trans>
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : items ? (
        <Empty>
          <Trans>目前没有金融通知。</Trans>
        </Empty>
      ) : loadError ? null : (
        <Skeleton className="h-20 w-full" />
      )}
    </section>
  );
}

function PushStatus({ value }: { value: FinanceNotification["pushStatus"] }) {
  const { t } = useLingui();
  const labels: Record<FinanceNotification["pushStatus"], string> = {
    pending: t`待发送`,
    accepted: t`服务已接受，送达未确认`,
    failed: t`发送失败`,
    unavailable: t`暂无可用设备`,
    muted: t`静默中`,
    uncertain: t`发送结果待确认`,
    read: t`已读`,
    expired: t`已过期`,
  };
  return labels[value];
}

function HealthRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end">{value}</dd>
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-prose rounded-xl bg-muted/50 px-4 py-5 text-sm leading-6 text-muted-foreground">
      {children}
    </p>
  );
}
function Quality({ quality }: { quality: "available" | "stale" | "missing" }) {
  return (
    <span className={`text-xs ${quality === "stale" ? "text-warning" : "text-muted-foreground"}`}>
      {quality === "available" ? (
        <Trans>有数据</Trans>
      ) : quality === "stale" ? (
        <Trans>数据陈旧</Trans>
      ) : (
        <Trans>暂无数据</Trans>
      )}
    </span>
  );
}
function amount(value: string | null) {
  return value === null ? "—" : value;
}
function time(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}
