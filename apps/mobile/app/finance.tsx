import type {
  FinanceAccount,
  FinanceNotification,
  FinanceOverview,
  FinanceRunDetail,
  FinanceSimulationCommandResult,
  FinanceWatchlistCommandResult,
  Me,
} from "@marketbot/contracts";
import {
  FinanceNotificationsSchema,
  FinanceOverviewSchema,
  FinanceRunDetailSchema,
} from "@marketbot/contracts";
import { Stack, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FinancialPortfolio } from "../components/financial-portfolio";
import { FinancialResearch } from "../components/financial-research";
import { FinancialRunInputs } from "../components/financial-run-inputs";
import { FinancialSimulation } from "../components/financial-simulation";
import { FinancialWatchlist } from "../components/financial-watchlist";
import { glassHeaderOptions } from "../components/glass-title";
import { NativeActionButton } from "../components/native-action-button";
import { NativeSegmentedControl } from "../components/native-segmented-control";
import { rpc } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { native, useMobileTokens, useThemedStyles } from "../lib/native";
import { errorText } from "../lib/user-error";

type Section = "overview" | "portfolio" | "research" | "simulation";

/** Native financial reading desk; the server owns all financial state and money. */
export default function FinanceScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const styles = useThemedStyles(createStyles);
  const [section, setSection] = useState<Section>("overview");
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [items, setItems] = useState<FinanceNotification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [reading, setReading] = useState<string | null>(null);
  const [detail, setDetail] = useState<FinanceRunDetail | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [owner, setOwner] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const runGeneration = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (overview?.availability === "unbound") {
      void rpc<Me>("me")
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
  }, [overview?.availability]);

  async function connect() {
    setConnecting(true);
    setLoadError(null);
    try {
      setOverview(FinanceOverviewSchema.parse(await rpc("finance/connect")));
    } catch (failure: unknown) {
      setLoadError(errorText(failure, t("无法创建金融工作区")));
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setNotificationError(null);
    const financial = rpc<unknown>("finance/overview")
      .then((value) => {
        if (!cancelled) setOverview(FinanceOverviewSchema.parse(value));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorText(error, t("无法加载金融工作台")));
      });
    const notifications = rpc<unknown>("finance/notifications")
      .then((value) => {
        if (!cancelled) setItems(FinanceNotificationsSchema.parse(value).items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setNotificationError(errorText(error, t("无法读取金融通知")));
      });
    void Promise.all([financial, notifications]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [retry, t]);

  useEffect(
    () => () => {
      runGeneration.current += 1;
    },
    [],
  );

  async function markRead(id: string) {
    setReading(id);
    setNotificationError(null);
    try {
      await rpc("finance/markRead", { id });
      setItems(FinanceNotificationsSchema.parse(await rpc("finance/notifications")).items);
    } catch (error: unknown) {
      setNotificationError(errorText(error, t("未能保存已读状态")));
    } finally {
      setReading(null);
    }
  }

  async function readRun(runId: number) {
    const request = ++runGeneration.current;
    setRunBusy(true);
    setRunError(null);
    setDetail(null);
    try {
      const value = FinanceRunDetailSchema.parse(await rpc("finance/run", { runId }));
      if (request === runGeneration.current) setDetail(value);
    } catch (error: unknown) {
      if (request === runGeneration.current) setRunError(errorText(error, t("无法读取模拟记录")));
    } finally {
      if (request === runGeneration.current) setRunBusy(false);
    }
  }

  const data = overview?.data;
  const simulationActive = !!data?.runs.some((run) => run.status === "running");
  useEffect(() => {
    if (!simulationActive || section !== "simulation") return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") setRetry((value) => value + 1);
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => setRetry((value) => value + 1)}
          tintColor={tokens.mutedForeground}
          colors={[tokens.mutedForeground]}
          progressBackgroundColor={tokens.background}
        />
      }
    >
      <Stack.Screen options={glassHeaderOptions(t("金融工作台"))} />
      <NativeSegmentedControl
        accessibilityLabel={t("金融工作台导航")}
        value={section}
        onChange={setSection}
        options={[
          { value: "overview", label: t("总览") },
          { value: "portfolio", label: t("持仓") },
          { value: "research", label: t("研究") },
          { value: "simulation", label: t("策略") },
        ]}
      />
      {section === "overview" ? (
        <NativeActionButton
          label={t("新闻与日报")}
          prominence="secondary"
          onPress={() => router.push("/intelligence")}
        />
      ) : null}
      {loadError ? (
        <View style={styles.section}>
          <Text accessibilityRole="alert" style={styles.error}>
            {loadError}
          </Text>
          <NativeActionButton
            label={t("重试")}
            prominence="secondary"
            onPress={() => setRetry((value) => value + 1)}
          />
        </View>
      ) : null}
      {loading && !overview ? (
        <ActivityIndicator
          color={tokens.mutedForeground}
          accessibilityLabel={t("正在读取金融数据")}
        />
      ) : null}
      {overview && !data ? (
        <View style={styles.section}>
          <Text style={styles.heading}>
            {overview.availability === "unconfigured"
              ? t("金融服务尚未连接")
              : overview.availability === "unbound"
                ? t("金融工作区尚未绑定")
                : t("金融服务暂时无法读取")}
          </Text>
          <Text style={styles.secondary}>
            {overview.message ?? t("完成服务配置后，可在这里查看自选、持仓、研究和模拟策略。")}
          </Text>
          {overview.availability === "unbound" ? (
            owner ? (
              <>
                <Text style={styles.secondary}>
                  {t("创建你的独立金融工作区后，可以添加自选。现有金融数据不会自动导入。")}
                </Text>
                <NativeActionButton
                  label={t("创建金融工作区")}
                  disabled={connecting}
                  busy={connecting}
                  onPress={() => void connect()}
                />
              </>
            ) : (
              <Text style={styles.secondary}>{t("请等待部署管理员为此账户绑定金融工作区。")}</Text>
            )
          ) : null}
        </View>
      ) : null}
      {data ? (
        <>
          <View style={styles.context}>
            <Text style={styles.caption}>
              {data.capabilities.readOnly ? `${t("只读")} · ` : ""}
              {t("日线模拟")}
            </Text>
            <Text style={styles.caption}>
              {t("读取时间")} {time(data.asOf)}
            </Text>
            {loadError || loading ? (
              <Text style={styles.caption}>{t("当前显示上次读取结果")}</Text>
            ) : null}
          </View>
          {section === "overview" ? (
            <>
              <FinancialWatchlist
                data={data}
                onChanged={applyWatchlist}
                onRefresh={() => setRetry((value) => value + 1)}
              />
              <Group title={t("最新研究")}>
                {data.reports.length ? (
                  data.reports.slice(0, 3).map((report) => (
                    <View key={report.id} style={styles.row}>
                      <Text style={styles.label}>
                        {report.name || report.symbol} · {report.symbol}
                      </Text>
                      <Text style={styles.caption}>
                        {time(report.createdAt)} · {qualityText(report.quality, t)}
                      </Text>
                      <Text numberOfLines={3} style={styles.body}>
                        {report.summary || t("该研究尚无摘要。")}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Empty>{t("还没有研究记录。")}</Empty>
                )}
              </Group>
            </>
          ) : null}
          {section === "portfolio" ? (
            <>
              <Group title={t("账户与持仓")}>
                {data.portfolio.accounts.length ? (
                  data.portfolio.accounts.map((account) => (
                    <Account key={account.id} account={account} />
                  ))
                ) : (
                  <Empty>{t("尚未记录持仓。金融工作区的账户与快照接入后会在这里显示。")}</Empty>
                )}
              </Group>
              <FinancialPortfolio
                data={data}
                refreshKey={retry}
                onChanged={() => setRetry((value) => value + 1)}
              />
            </>
          ) : null}
          {section === "research" ? (
            <>
              <FinancialResearch />
              <Group title={t("历史分析报告")}>
                {data.reports.length ? (
                  data.reports.map((report) => (
                    <View key={report.id} style={styles.row}>
                      <Text style={styles.label}>
                        {report.name || report.symbol} · {report.symbol}
                      </Text>
                      <Text style={styles.caption}>
                        {time(report.createdAt)} · {qualityText(report.quality, t)}
                      </Text>
                      <Text selectable style={styles.body}>
                        {report.summary || t("该研究尚无摘要。")}
                      </Text>
                      {report.advice ? (
                        <Text selectable style={styles.secondary}>
                          {report.advice}
                        </Text>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <Empty>{t("还没有研究记录。金融引擎生成的分析会保留在这里。")}</Empty>
                )}
              </Group>
            </>
          ) : null}
          {section === "simulation" ? (
            <>
              {simulationActive ? (
                <Text style={styles.caption}>{t("模拟任务进行中，每 15 秒刷新状态。")}</Text>
              ) : null}
              <FinancialSimulation data={data} refreshKey={retry} onApplied={applySimulation} />
              <Group title={t("日线模拟")}>
                {data.runs.length ? (
                  data.runs.map((run) => (
                    <View key={run.id} style={styles.row}>
                      <View style={styles.between}>
                        <Text style={styles.label}>{run.name}</Text>
                        <Text style={styles.caption}>{runStatusText(run.status, t)}</Text>
                      </View>
                      <Text style={styles.caption}>
                        {run.market.toUpperCase()} ·{" "}
                        {run.mode === "paper"
                          ? t("模拟盯盘")
                          : run.mode === "backtest"
                            ? t("回测")
                            : run.mode}{" "}
                        ·{" "}
                        {["rule", "rules"].includes(run.decisionBackend)
                          ? t("规则驱动")
                          : run.decisionBackend}
                      </Text>
                      <Text style={styles.body}>
                        {t("权益")} {amount(run.equity)} {run.currency}
                      </Text>
                      <Text style={styles.caption}>
                        {t("最后交易日")} {run.lastTradingDate ?? "—"}
                      </Text>
                      <NativeActionButton
                        label={t("查看账本")}
                        prominence="secondary"
                        busy={runBusy}
                        onPress={() => void readRun(run.id)}
                      />
                    </View>
                  ))
                ) : (
                  <Empty>{t("尚无模拟运行。策略运行与交易日账本由金融引擎管理。")}</Empty>
                )}
              </Group>
              {runError ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {runError}
                </Text>
              ) : null}
              {detail ? (
                <Group title={`${detail.name} · ${t("交易日账本")}`}>
                  <View style={styles.row}>
                    <Text style={styles.caption}>
                      {t("已评估交易日")} {detail.evaluatedTradingDays} · {t("本页展示")}{" "}
                      {detail.displayedTradingDays}
                      {detail.historyTruncated ? ` · ${t("历史已截断，仅展示最近记录")}` : ""}
                    </Text>
                    <Text style={styles.caption}>
                      {t("收益与风险统计为派生估算。")}
                      {detail.ledgerPrecision === "decimal_v1"
                        ? t("资金和模拟成交使用十进制账本。")
                        : t("这是旧版浮点账本，仅供读取复盘。")}
                    </Text>
                    <Text selectable style={styles.caption}>
                      {t("冻结策略")} · {detail.strategyRef.ruleId ?? "—"} · v
                      {detail.strategyRef.version ?? "—"} · {t("版本引用")}{" "}
                      {detail.strategyRef.strategyVersionId}
                    </Text>
                    {detail.strategyRef.digest ? (
                      <Text selectable style={styles.caption}>
                        {t("规则摘要")} {detail.strategyRef.digest}
                      </Text>
                    ) : null}
                    {detail.decimalRules ? (
                      <Text selectable style={styles.caption}>
                        {t("冻结规则")} {JSON.stringify(detail.decimalRules, null, 2)}
                      </Text>
                    ) : null}
                  </View>
                  <RunMetrics metrics={detail.metrics} />
                  {detail.days.length ? (
                    detail.days.map((day) => (
                      <View key={day.recordId} style={styles.row}>
                        <View style={styles.between}>
                          <Text style={styles.label}>{day.tradingDate}</Text>
                          <Text style={styles.body}>
                            {amount(day.equity)} {detail.currency}
                          </Text>
                        </View>
                        <Text style={styles.caption}>
                          {t("账本记录")} #{day.recordId} · {time(day.recordedAt)}
                        </Text>
                        {Object.keys(day.inputSources).length ? (
                          <Text selectable style={styles.caption}>
                            {t("数据来源")} ·{" "}
                            {Object.entries(day.inputSources)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(" · ")}
                          </Text>
                        ) : null}
                        <FinancialRunInputs
                          runId={detail.id}
                          recordId={day.recordId}
                          tradingDate={day.tradingDate}
                        />
                        {day.trades.length ? (
                          day.trades.map((trade, index) => (
                            <View key={`${trade.symbol}:${index}`} style={styles.trade}>
                              <Text style={styles.body}>
                                {trade.symbol} · {trade.side} · {trade.status}
                              </Text>
                              <Text style={styles.caption}>
                                {amount(trade.quantity)} @ {amount(trade.price)} · {t("费用")}{" "}
                                {amount(trade.fee)} · {t("滑点")} {amount(trade.slippage)}
                              </Text>
                              {trade.reason ? (
                                <Text style={styles.caption}>{trade.reason}</Text>
                              ) : null}
                              <Text style={styles.caption}>
                                {t("信号交易日")} {trade.signalDate ?? "—"} · {t("模拟订单")}{" "}
                                {trade.orderId ?? "—"} · {t("模拟成交")} {trade.fillId ?? "—"}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.caption}>{t("该交易日没有模拟成交。")}</Text>
                        )}
                      </View>
                    ))
                  ) : (
                    <Empty>{t("尚无交易日记录。")}</Empty>
                  )}
                </Group>
              ) : null}
            </>
          ) : null}
          {section === "overview" ? (
            <Group title={t("服务状态")}>
              <View style={styles.row}>
                <Text style={styles.body}>
                  {t("持仓数据")} · {qualityText(data.portfolio.quality, t)}
                </Text>
                <Text style={styles.caption}>
                  {t("事件序号")} {data.health.eventHighWater}
                </Text>
                {data.health.eventSync ? (
                  <>
                    <Text style={styles.caption}>
                      {t("通知同步")} ·{" "}
                      {data.health.eventSync.status === "ready"
                        ? t("已同步")
                        : data.health.eventSync.status === "pending"
                          ? t("等待同步")
                          : data.health.eventSync.status === "recovery_required"
                            ? t("需恢复事件游标")
                            : t("暂不可用")}
                    </Text>
                    <Text style={styles.caption}>
                      {t("已接收事件序号")} {data.health.eventSync.cursor} · {t("待同步事件")}{" "}
                      {data.health.eventSync.lag}
                    </Text>
                    <Text style={styles.caption}>
                      {t("最近同步")} {time(data.health.eventSync.updatedAt)}
                    </Text>
                  </>
                ) : null}
                {data.health.precisionAudit !== "passed" ? (
                  <Text style={styles.secondary}>
                    {t(
                      "历史账本精度尚未通过验证，保留读取用于复盘。新模拟账户的可用操作以规则目录和服务能力为准。",
                    )}
                  </Text>
                ) : null}
                {data.health.warnings
                  ?.filter((warning) => warning !== "legacy_float_storage")
                  .map((warning) => (
                    <Text key={warning} style={styles.secondary}>
                      {warning === "legacy_report_timezone_unknown"
                        ? t("部分历史分析报告未记录时区，请结合原始报告核对日期。")
                        : t("服务有待处理的数据质量提示，请检查连接与原始记录。")}
                    </Text>
                  ))}
              </View>
            </Group>
          ) : null}
        </>
      ) : null}
      {section === "overview" ? (
        <Group title={t("金融通知")}>
          {notificationError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {notificationError}
            </Text>
          ) : null}
          {items?.length ? (
            items.map((item) => (
              <View key={item.id} style={styles.row}>
                <Text style={styles.label}>{item.title}</Text>
                {item.kind === "integration.test" ? (
                  <Text style={styles.caption}>{t("集成测试")}</Text>
                ) : null}
                <Text style={styles.secondary}>{item.body}</Text>
                <Text style={styles.caption}>{time(item.recordedAt)}</Text>
                <Text style={styles.caption}>
                  {t("设备推送")} · {pushStatusText(item.pushStatus, t)} · {t("尝试次数")}{" "}
                  {item.pushAttempts}
                </Text>
                {item.lastPushAt ? (
                  <Text style={styles.caption}>
                    {t("最近尝试")} {time(item.lastPushAt)}
                  </Text>
                ) : null}
                {item.readAt ? (
                  <Text style={styles.caption}>{t("已读")}</Text>
                ) : (
                  <NativeActionButton
                    label={t("标为已读")}
                    prominence="secondary"
                    disabled={reading !== null}
                    busy={reading === item.id}
                    onPress={() => void markRead(item.id)}
                  />
                )}
              </View>
            ))
          ) : items ? (
            <Empty>{t("目前没有金融通知。")}</Empty>
          ) : notificationError ? null : (
            <ActivityIndicator color={tokens.mutedForeground} />
          )}
        </Group>
      ) : null}
    </ScrollView>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function Account({ account }: { account: FinanceAccount }) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{account.name}</Text>
      <Text style={styles.caption}>
        {account.market.toUpperCase()} · {account.currency} · {qualityText(account.quality, t)}
      </Text>
      <Text style={styles.caption}>
        {t("快照")} {account.snapshotDate ?? "—"}
      </Text>
      <View style={styles.trade}>
        <Text style={styles.body}>
          {t("权益")} {amount(account.equity)} {account.currency}
        </Text>
        <Text style={styles.secondary}>
          {t("现金")} {amount(account.cash)} · {t("持仓市值")} {amount(account.marketValue)}
        </Text>
      </View>
      {account.positions.length ? (
        account.positions.map((position) => (
          <View key={position.assetId} style={styles.position}>
            <View style={styles.between}>
              <Text style={styles.label}>{position.symbol}</Text>
              <Text style={styles.body}>
                {amount(position.marketValue)} {account.currency}
              </Text>
            </View>
            <Text style={styles.caption}>
              {t("数量")} {amount(position.quantity)} · {t("成本")} {amount(position.averageCost)} ·{" "}
              {t("最新价")} {amount(position.lastPrice)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.secondary}>
          {account.quality === "missing" || !account.snapshotDate
            ? t("持仓快照尚不可用。手工账户的记账数量可在下方查看。")
            : t("该快照没有持仓记录。")}
        </Text>
      )}
    </View>
  );
}

function Empty({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return <Text style={styles.empty}>{children}</Text>;
}
function amount(value: string | null) {
  return value ?? "—";
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

function RunMetrics({ metrics }: { metrics: FinanceRunDetail["metrics"] }) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const labels: Record<string, string> = {
    cumulativeReturn: t("累计收益率"),
    dailyReturn: t("单日收益率"),
    annualizedReturn: t("年化收益率"),
    maxDrawdown: t("最大回撤"),
    annualizedVolatility: t("年化波动率"),
    turnover: t("换手率"),
    sharpe: t("夏普比率"),
    calmar: t("卡玛比率"),
  };
  const items = Object.entries(labels).filter(([key]) => Object.hasOwn(metrics, key));
  if (!items.length) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.caption}>
        {t("收益与风险统计为派生估算；样本不足的年化指标保持空值。")}
      </Text>
      {items.map(([key, label]) => (
        <Text key={key} style={styles.body}>
          {label} ·{" "}
          {metrics[key] === null
            ? t("样本不足或未知")
            : derivedMetric(metrics[key] ?? null, key !== "sharpe" && key !== "calmar")}
        </Text>
      ))}
    </View>
  );
}
function derivedMetric(value: string | null, ratio: boolean) {
  if (value === null) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return `${(ratio ? number * 100 : number).toLocaleString(undefined, { maximumFractionDigits: 2 })}${ratio ? "%" : ""}`;
}
function runStatusText(value: string, t: (value: string) => string) {
  const labels: Record<string, string> = {
    ready: t("待启动"),
    running: t("运行中"),
    paused: t("已暂停"),
    stopped: t("已终止"),
    completed: t("已完成"),
    failed: t("失败"),
  };
  return labels[value] ?? value;
}
function pushStatusText(value: FinanceNotification["pushStatus"], t: (value: string) => string) {
  const labels: Record<FinanceNotification["pushStatus"], string> = {
    pending: t("待发送"),
    accepted: t("服务已接受，送达未确认"),
    failed: t("发送失败"),
    unavailable: t("暂无可用设备"),
    muted: t("静默中"),
    uncertain: t("发送结果待确认"),
    read: t("已读"),
    expired: t("已过期"),
  };
  return labels[value];
}
function qualityText(value: "available" | "stale" | "missing", t: (value: string) => string) {
  return value === "available" ? t("有数据") : value === "stale" ? t("数据陈旧") : t("暂无数据");
}

function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: tokens.background },
    content: { padding: 20, paddingBottom: 48, gap: 24 },
    section: { gap: 12 },
    heading: { color: tokens.foreground, fontSize: 20, fontWeight: "600" },
    group: { borderRadius: 14, backgroundColor: native.groupedCell, overflow: "hidden" },
    row: {
      padding: 16,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.border,
    },
    between: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
    },
    context: { gap: 6 },
    label: { color: tokens.foreground, fontSize: 17, fontWeight: "600" },
    body: { color: tokens.foreground, fontSize: 17, lineHeight: 25, fontVariant: ["tabular-nums"] },
    secondary: { color: tokens.mutedForeground, fontSize: 15, lineHeight: 23 },
    caption: { color: tokens.mutedForeground, fontSize: 13, lineHeight: 20 },
    empty: { padding: 16, color: tokens.mutedForeground, fontSize: 15, lineHeight: 23 },
    error: { color: tokens.destructive, fontSize: 15, lineHeight: 23 },
    trade: { gap: 5, paddingVertical: 8 },
    position: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.border,
      paddingTop: 12,
      gap: 5,
    },
  });
}
