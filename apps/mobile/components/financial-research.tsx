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
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { useMobileTokens, useThemedStyles } from "../lib/native";
import { useFinanceIntent, useFinanceSession } from "../lib/use-finance-session";
import { errorText } from "../lib/user-error";
import { MenuPicker } from "./menu-picker";
import { NativeActionButton } from "./native-action-button";
import { ResearchObservations } from "./research-observations";

export function FinancialResearch() {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const tokens = useMobileTokens();
  const [data, setData] = useState<FinanceResearchOverview | null>(null);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<FinanceResearchCommand | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FinanceResearchRequest | null>(null);
  const [market, setMarket] = useState("cn");
  const [kind, setKind] = useState("research");
  const [symbol, setSymbol] = useState("");
  const [reportType, setReportType] = useState("detailed");

  const session = useFinanceSession(setError);
  const storageKey = useFinanceIntent(
    session,
    "research",
    FinanceResearchCommandSchema,
    setPending,
    setError,
    t("无法恢复研究操作记录"),
  );

  useEffect(() => {
    if (!session?.isCurrent()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void session!
      .request("finance/researchOverview")
      .then((value) => {
        if (!cancelled && session!.isCurrent()) setData(FinanceResearchOverviewSchema.parse(value));
      })
      .catch((failure: unknown) => {
        if (!cancelled && session!.isCurrent())
          setError(errorText(failure, t("无法读取研究服务与预算")));
      })
      .finally(() => {
        if (!cancelled && session!.isCurrent()) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry, t]);
  const active = !!data?.requests.some(
    (request) => request.status === "queued" || request.status === "running",
  );
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") setRetry((value) => value + 1);
    }, 15_000);
    return () => clearInterval(timer);
  }, [active]);

  async function clearIntent() {
    if (!session?.isCurrent() || !storageKey) throw new Error("Financial session changed");
    await session.clear(storageKey);
  }
  async function applied(request: FinanceResearchRequest) {
    await clearIntent();
    if (!session?.isCurrent()) return;
    setPending(null);
    setMissing(false);
    setSelected(request);
    setSymbol("");
    setRetry((value) => value + 1);
  }
  async function send(command: FinanceResearchCommand) {
    if (!storageKey || busy || !session?.isCurrent()) return;
    setBusy(true);
    try {
      await session!.persist(storageKey, JSON.stringify(command));
    } catch {
      if (!session?.isCurrent()) return;
      setError(t("无法保存操作编号，本次请求未发送。"));
      setBusy(false);
      return;
    }
    setPending(command);
    setMissing(false);
    setError(null);
    try {
      await applied(
        FinanceResearchRequestSchema.parse(
          await session!.request("finance/researchCommand", command),
        ),
      );
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      const code =
        failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (["BAD_REQUEST", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(code)) {
        try {
          await clearIntent();
        } catch {
          if (session?.isCurrent()) setError(t("无法清理本地操作记录，请保留原编号查询结果。"));
          return;
        }
        if (!session?.isCurrent()) return;
        setPending(null);
        setError(errorText(failure, t("研究请求未应用，请刷新后再试")));
      } else setError(t("尚未确认研究请求结果，请先查询；重试会保留原操作编号。"));
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }
  async function check() {
    if (!pending || busy || !session?.isCurrent()) return;
    setBusy(true);
    setError(null);
    try {
      const value = await session!.request("finance/researchCommandStatus", {
        commandType: pending.commandType,
        idempotencyKey: pending.idempotencyKey,
      });
      if (value) await applied(FinanceResearchRequestSchema.parse(value));
      else setMissing(true);
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      setError(errorText(failure, t("暂时无法查询，请稍后再查")));
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }
  async function readRequest(requestId: string) {
    if (!session?.isCurrent()) return;
    setBusy(true);
    setError(null);
    try {
      setSelected(
        FinanceResearchRequestSchema.parse(
          await session!.request("finance/researchRequest", { requestId }),
        ),
      );
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      setError(errorText(failure, t("无法读取研究任务")));
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }
  const current = data?.requests.find((request) => request.id === selected?.id) ?? selected;
  const inactive =
    busy ||
    loading ||
    !!pending ||
    !storageKey ||
    !data?.capabilities.enabled ||
    !!data?.usage.blocked;
  function create() {
    if (inactive || kind !== "research") return;
    const command = FinanceResearchCommandSchema.safeParse({
      commandType: "research.create",
      idempotencyKey: `research:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`,
      market,
      symbol: symbol.trim(),
      reportType,
    });
    if (!command.success) {
      setError(t("请填写有效标的代码。"));
      return;
    }
    void send(command.data);
  }
  if (!session) return <Text accessibilityRole="alert">{error ?? t("正在确认金融会话…")}</Text>;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t("发起投研")}</Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {loading && !data ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
      {data ? (
        <>
          {!data.capabilities.enabled ? (
            <Text style={styles.secondary}>
              {t("研究服务尚未开放。需要服务端准备行情与模型能力后，才能发起真实研究。")}
            </Text>
          ) : null}
          {data.usage.blocked ? (
            <Text style={styles.error}>
              {t("预算暂不可用，研究请求已暂停。未知用量会保留预算，不会当作零消耗。")}
            </Text>
          ) : null}
          <View style={styles.group}>
            <Text style={styles.label}>
              {t("Token 预算")} · {data.usage.day} · UTC
            </Text>
            <Text style={styles.body}>
              {t("每日额度")} {data.usage.tokenLimit} · {t("剩余")} {data.usage.remainingTokens}
            </Text>
            <Text style={styles.caption}>
              {t("已占用预算")} {data.usage.committedTokens} · {t("已验证用量")}{" "}
              {data.usage.verifiedTokens}
            </Text>
            <Text style={styles.caption}>
              {t("未知调用保留")} {data.usage.unverifiedReservedTokens}
            </Text>
            <Text style={styles.caption}>
              {t("单次请求上限")} {data.capabilities.requestTokenLimit} · {t("最大输出")}{" "}
              {data.capabilities.maxOutputTokens}
            </Text>
            <Text style={styles.caption}>{t("费用信息：未提供")}</Text>
          </View>
          {pending ? (
            <View style={styles.group}>
              <Text selectable style={styles.caption}>
                {t("待确认请求")} · {pending.commandType} · {pending.idempotencyKey}
              </Text>
              <NativeActionButton
                label={t("查询研究请求结果")}
                disabled={busy}
                prominence="secondary"
                onPress={() => void check()}
              />
              {missing ? (
                <NativeActionButton
                  label={t("重试同一研究请求")}
                  disabled={busy || !data.capabilities.enabled || data.usage.blocked}
                  prominence="secondary"
                  onPress={() => void send(pending)}
                />
              ) : null}
            </View>
          ) : null}
          <View style={styles.group}>
            <View pointerEvents={busy || pending ? "none" : "auto"}>
              <MenuPicker
                label={t("研究类型")}
                value={kind}
                choices={[
                  { key: "research", label: t("单个标的分析") },
                  { key: "screening", label: t("条件筛选（待规则目录）") },
                ]}
                onChange={setKind}
              />
              <MenuPicker
                label={t("市场")}
                value={market}
                choices={[
                  { key: "cn", label: t("A 股") },
                  { key: "crypto", label: t("加密资产") },
                ]}
                onChange={setMarket}
              />
              {kind === "research" ? (
                <MenuPicker
                  label={t("报告深度")}
                  value={reportType}
                  choices={[
                    { key: "simple", label: t("简要") },
                    { key: "detailed", label: t("详细") },
                  ]}
                  onChange={setReportType}
                />
              ) : null}
            </View>
            {kind === "research" ? (
              <>
                <Text style={styles.caption}>{t("标的代码")}</Text>
                <TextInput
                  style={styles.input}
                  accessibilityLabel={t("标的代码")}
                  value={symbol}
                  onChangeText={setSymbol}
                  maxLength={32}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!inactive}
                  placeholder={market === "cn" ? "600519" : "BTCUSDT"}
                  placeholderTextColor={tokens.mutedForeground}
                />
              </>
            ) : (
              <Text style={styles.secondary}>
                {t("条件筛选将在金融服务提供可用规则目录后开放。")}
              </Text>
            )}
            <NativeActionButton
              label={t("提交研究任务")}
              disabled={inactive || kind !== "research" || !symbol.trim()}
              onPress={create}
            />
          </View>
          <View style={styles.actions}>
            <NativeActionButton
              label={t("刷新研究状态")}
              disabled={busy || loading}
              prominence="secondary"
              onPress={() => setRetry((value) => value + 1)}
            />
            {active ? (
              <Text style={styles.caption}>{t("任务进行中，每 15 秒刷新状态。")}</Text>
            ) : null}
          </View>
          <Text style={styles.heading}>{t("最近 50 个研究任务")}</Text>
          {data.requests.length ? (
            data.requests.map((request) => (
              <View key={request.id} style={styles.group}>
                <Text style={styles.label}>
                  {request.commandType === "research.create" ? t("标的研究") : t("条件筛选")} ·{" "}
                  {typeof request.request.symbol === "string"
                    ? request.request.symbol
                    : typeof request.request.strategy === "string"
                      ? request.request.strategy
                      : request.id}
                </Text>
                <Text style={styles.caption}>
                  {requestStatus(request.status, t)} · {time(request.createdAt)}
                </Text>
                <NativeActionButton
                  label={t("查看研究任务")}
                  disabled={busy}
                  prominence="secondary"
                  onPress={() => void readRequest(request.id)}
                />
              </View>
            ))
          ) : (
            <Text style={styles.secondary}>{t("尚无研究任务，系统不会生成示例报告。")}</Text>
          )}
        </>
      ) : null}
      {current ? (
        <View style={styles.group}>
          <Text style={styles.heading}>
            {t("任务详情")} · {requestStatus(current.status, t)}
          </Text>
          <Text selectable style={styles.caption}>
            {current.id} · {time(current.createdAt)}
          </Text>
          {current.error ? (
            <Text style={styles.error}>
              {t("任务未完成")} · {current.error.code}
            </Text>
          ) : null}
          {current.result ? (
            <>
              <Text style={styles.label}>{t("结构化结果")}</Text>
              <Text selectable style={styles.code}>
                {JSON.stringify(current.result, null, 2)}
              </Text>
            </>
          ) : null}
          {current.modelOutputs.length ? (
            current.modelOutputs.map((output) => (
              <View key={output.callId} style={styles.section}>
                <Text style={styles.label}>
                  {output.model} · {output.status}
                </Text>
                <Text selectable style={styles.body}>
                  {output.output.content || t("该调用尚无可见输出。")}
                </Text>
                {output.output.truncated ? (
                  <Text style={styles.caption}>{t("输出已按服务端长度限制截断。")}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.secondary}>{t("该任务尚无可见模型输出。")}</Text>
          )}
          <Text style={styles.caption}>{t("费用信息：未提供")}</Text>
        </View>
      ) : null}
      <ResearchObservations request={current} />
    </View>
  );
}
function requestStatus(value: FinanceResearchRequest["status"], t: (value: string) => string) {
  const labels = {
    queued: t("排队中"),
    running: t("运行中"),
    succeeded: t("已完成"),
    failed: t("失败"),
    interrupted: t("已中断"),
  };
  return labels[value];
}
function time(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    section: { gap: 16, marginBottom: 24 },
    group: {
      gap: 14,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.border,
      borderRadius: 12,
    },
    actions: { gap: 8 },
    heading: { color: tokens.foreground, fontSize: 20, fontWeight: "600" },
    label: { color: tokens.foreground, fontSize: 17, fontWeight: "600" },
    body: { color: tokens.foreground, fontSize: 16, lineHeight: 25 },
    secondary: { color: tokens.mutedForeground, fontSize: 15, lineHeight: 23 },
    caption: { color: tokens.mutedForeground, fontSize: 13, lineHeight: 20 },
    error: { color: tokens.destructive, fontSize: 15, lineHeight: 23 },
    code: {
      color: tokens.foreground,
      fontSize: 13,
      lineHeight: 21,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    input: {
      color: tokens.foreground,
      backgroundColor: tokens.background,
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 10,
      minHeight: 48,
      paddingHorizontal: 14,
      fontSize: 17,
    },
  });
}
