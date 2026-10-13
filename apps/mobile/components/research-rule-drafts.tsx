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
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { useMobileTokens, useThemedStyles } from "../lib/native";
import { useFinanceIntent, useFinanceSession } from "../lib/use-finance-session";
import { errorText } from "../lib/user-error";
import { MenuPicker } from "./menu-picker";
import { NativeActionButton } from "./native-action-button";

export function ResearchRuleDrafts({ observations }: { observations: FinanceObservation[] }) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const tokens = useMobileTokens();
  const [items, setItems] = useState<FinanceRuleDraft[]>([]);
  const [pending, setPending] = useState<FinanceRuleDraftInput | null>(null);
  const [missing, setMissing] = useState(false);
  const [catalog, setCatalog] = useState<FinanceSimulationCatalog | null>(null);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [observationId, setObservationId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("paper");
  const [symbols, setSymbols] = useState("");
  const [cash, setCash] = useState("");
  const [commission, setCommission] = useState("0.001");
  const [slippage, setSlippage] = useState("0.0005");
  const [sellTax, setSellTax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const hasObservations = observations.length > 0;
  const session = useFinanceSession(setError);
  const storageKey = useFinanceIntent(
    session,
    "rule-draft",
    FinanceRuleDraftInputSchema,
    setPending,
    setError,
    t("无法恢复规则草稿操作"),
  );

  useEffect(() => {
    if (!session?.isCurrent()) return;
    let cancelled = false;
    setLoading(true);
    void session!
      .request("finance/ruleDrafts", {})
      .then((raw) => {
        if (!cancelled && session!.isCurrent())
          setItems(FinanceRuleDraftSchema.array().max(100).parse(raw));
      })
      .catch((failure: unknown) => {
        if (!cancelled && session!.isCurrent()) setError(errorText(failure, t("无法读取规则草稿")));
      })
      .finally(() => {
        if (!cancelled && session!.isCurrent()) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, refresh, t]);
  useEffect(() => {
    if (!hasObservations || !session?.isCurrent()) return;
    let cancelled = false;
    void Promise.all([
      session!.request("finance/overview", {}),
      session!.request("finance/simulationCatalog", {}),
    ])
      .then(([raw, value]) => {
        if (!cancelled && session!.isCurrent()) {
          setCatalog(FinanceSimulationCatalogSchema.parse(value));
          setSupported(
            !!FinanceOverviewSchema.parse(raw).data?.capabilities.supportedCommands.includes(
              "simulation.create",
            ),
          );
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled && session!.isCurrent()) {
          setCatalog(null);
          setSupported(false);
          setError(errorText(failure, t("规则目录暂时不可用")));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, hasObservations, refresh, t]);
  const rules =
    catalog?.rules.filter((rule) => rule.available && catalog.markets.includes(rule.market)) ?? [];
  const selected = rules.find((rule) => rule.id === ruleId);
  const allowed = supported && catalog?.enabled && rules.length > 0;
  const disabled = busy || !!pending || !storageKey;
  async function clear() {
    if (!session?.isCurrent() || !storageKey) throw new Error("Financial session changed");
    await session.clear(storageKey);
    setPending(null);
    setMissing(false);
  }
  async function accept(raw: unknown, intent: FinanceRuleDraftInput) {
    const item = FinanceRuleDraftSchema.parse(raw);
    if (!financeRuleDraftMatchesInput(item, intent)) throw new Error("Draft receipt mismatch");
    await clear();
    if (!session?.isCurrent()) return;
    setError(null);
    setName("");
    setCash("");
    setExpanded(false);
    setItems((values) => [item, ...values.filter((value) => value.id !== item.id)].slice(0, 100));
  }
  async function send(input: FinanceRuleDraftInput) {
    if (busy || !storageKey || !session?.isCurrent()) return;
    setBusy(true);
    setError(null);
    setMissing(false);
    try {
      await session!.persist(storageKey, JSON.stringify(input));
    } catch {
      if (!session?.isCurrent()) return;
      setError(t("无法保存操作编号，草稿未发送。"));
      setBusy(false);
      return;
    }
    setPending(input);
    try {
      await accept(await session!.request("finance/saveRuleDraft", input), input);
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      const code =
        failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (["BAD_REQUEST", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(code)) {
        try {
          await clear();
        } catch {
          if (session?.isCurrent()) setError(t("无法清理本地操作记录，请保留原编号查询结果。"));
          return;
        }
        if (!session?.isCurrent()) return;
        setError(errorText(failure, t("草稿未保存，请检查观察记录与规则目录。")));
      } else setError(t("保存结果尚未确认，请先查询原操作。"));
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }
  async function query() {
    if (!pending || busy || !session?.isCurrent()) return;
    setBusy(true);
    setError(null);
    try {
      const item = await session!.request("finance/ruleDraftStatus", {
        idempotencyKey: pending.idempotencyKey,
      });
      if (item) await accept(item, pending);
      else setMissing(true);
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      setError(errorText(failure, t("无法查询草稿保存结果")));
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }
  function create() {
    if (!allowed || !selected || disabled) return;
    const input = FinanceRuleDraftInputSchema.safeParse({
      observationId,
      idempotencyKey: `rule-draft:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`,
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
    if (!input.success || !observations.some((item) => item.id === observationId)) {
      setError(t("请选择原观察记录并填写有效的模拟配置。"));
      return;
    }
    void send(input.data);
  }
  async function copy(item: FinanceRuleDraft) {
    try {
      const success = await Clipboard.setStringAsync(JSON.stringify(item.configuration, null, 2));
      if (success) setCopied(item.id);
      else throw new Error("Clipboard unavailable");
    } catch {
      setError(t("无法访问剪贴板，可以从配置详情手动复制。"));
    }
  }
  if (!session) return <Text accessibilityRole="alert">{error ?? t("正在确认金融会话…")}</Text>;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t("规则草稿")}</Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {pending ? (
        <View style={styles.group}>
          <Text selectable style={styles.caption}>
            {t("待确认草稿")} · {pending.idempotencyKey}
          </Text>
          <Text style={styles.body}>{pending.configuration.name}</Text>
          <NativeActionButton
            label={t("查询草稿保存结果")}
            disabled={busy}
            prominence="secondary"
            onPress={() => void query()}
          />
          {missing ? (
            <NativeActionButton
              label={t("重试同一规则草稿")}
              disabled={busy}
              prominence="secondary"
              onPress={() => void send(pending)}
            />
          ) : null}
        </View>
      ) : hasObservations && allowed ? (
        <>
          <NativeActionButton
            label={expanded ? t("收起草稿表单") : t("记录规则草稿")}
            disabled={disabled}
            prominence="secondary"
            onPress={() => setExpanded(!expanded)}
          />
          {expanded ? (
            <View style={styles.group}>
              <Text style={styles.caption}>
                {t("手动选择内置规则并保存配置；不会运行模拟。规则版本在以后创建模拟时才冻结。")}
              </Text>
              <View pointerEvents={disabled ? "none" : "auto"}>
                <MenuPicker
                  label={t("原观察记录")}
                  value={observationId}
                  choices={[
                    { key: "", label: t("选择观察记录") },
                    ...observations.map((item) => ({
                      key: item.id,
                      label: item.note.slice(0, 60),
                    })),
                  ]}
                  onChange={setObservationId}
                />
                <MenuPicker
                  label={t("可用内置规则")}
                  value={ruleId}
                  choices={[
                    { key: "", label: t("选择规则") },
                    ...rules.map((rule) => ({
                      key: rule.id,
                      label: `${rule.name} · ${rule.market.toUpperCase()}`,
                    })),
                  ]}
                  onChange={setRuleId}
                />
                <MenuPicker
                  label={t("模拟方式")}
                  value={mode}
                  choices={[
                    { key: "paper", label: t("日线模拟盯盘") },
                    { key: "backtest", label: t("日线回测") },
                  ]}
                  onChange={setMode}
                />
              </View>
              <Field
                label={t("草稿名称")}
                value={name}
                onChange={setName}
                maxLength={100}
                disabled={disabled}
              />
              {selected?.id === "crypto_btc_hold" ? (
                <Text style={styles.caption}>BTCUSDT</Text>
              ) : (
                <Field
                  label={t("标的代码（逗号分隔）")}
                  value={symbols}
                  onChange={setSymbols}
                  maxLength={780}
                  disabled={disabled}
                />
              )}
              <Field
                label={t("模拟初始现金")}
                value={cash}
                onChange={setCash}
                maxLength={80}
                disabled={disabled}
              />
              <Field
                label={t("佣金比例")}
                value={commission}
                onChange={setCommission}
                maxLength={80}
                disabled={disabled}
              />
              <Field
                label={t("滑点比例")}
                value={slippage}
                onChange={setSlippage}
                maxLength={80}
                disabled={disabled}
              />
              {selected?.market === "cn" ? (
                <Field
                  label={t("卖出税率假设")}
                  value={sellTax}
                  onChange={setSellTax}
                  maxLength={80}
                  disabled={disabled}
                />
              ) : null}
              {mode === "backtest" ? (
                <>
                  <Field
                    label={t("回测开始日期 YYYY-MM-DD")}
                    value={startDate}
                    onChange={setStartDate}
                    maxLength={10}
                    disabled={disabled}
                  />
                  <Field
                    label={t("回测结束日期 YYYY-MM-DD")}
                    value={endDate}
                    onChange={setEndDate}
                    maxLength={10}
                    disabled={disabled}
                  />
                </>
              ) : null}
              <NativeActionButton
                label={t("只保存规则草稿")}
                disabled={disabled || !selected || !observationId || !name.trim() || !cash.trim()}
                onPress={create}
              />
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.caption}>
          {hasObservations
            ? t("规则目录尚未开放；已有草稿仍可查看。")
            : t("保存真实研究的观察记录后，可为可用内置规则记录草稿。")}
        </Text>
      )}
      <NativeActionButton
        label={t("刷新规则草稿")}
        disabled={loading || busy}
        prominence="secondary"
        onPress={() => {
          setError(null);
          setRefresh((value) => value + 1);
        }}
      />
      {loading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
      {items.map((item) => (
        <View style={styles.group} key={item.id}>
          <Text style={styles.label}>{item.configuration.name}</Text>
          <Text style={styles.caption}>
            {t("未运行草稿")} · {item.rule.name} · {new Date(item.createdAt).toLocaleString()}
          </Text>
          <Text style={styles.caption}>
            {t("配置已保存；规则版本尚未冻结，不代表研究建议可以直接执行。")}
          </Text>
          <NativeActionButton
            label={copied === item.id ? t("配置已复制") : t("复制配置")}
            prominence="secondary"
            onPress={() => void copy(item)}
          />
          <NativeActionButton
            label={visible === item.id ? t("收起配置与原研究快照") : t("配置与原研究快照")}
            prominence="secondary"
            onPress={() => setVisible(visible === item.id ? null : item.id)}
          />
          {visible === item.id ? (
            <Text selectable style={styles.body}>
              {JSON.stringify(
                { configuration: item.configuration, researchSnapshot: item.researchSnapshot },
                null,
                2,
              )}
            </Text>
          ) : null}
          <Text selectable style={styles.caption}>
            {t("原观察")} · {item.observationId} · {t("原研究")} · {item.requestId}
          </Text>
          <Text selectable style={styles.caption}>
            SHA-256 · {item.researchSnapshotDigest}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  maxLength: number;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.caption}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        maxLength={maxLength}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    section: { gap: 16, marginTop: 8 },
    field: { gap: 8 },
    group: {
      gap: 14,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.border,
      borderRadius: 12,
    },
    heading: { color: tokens.foreground, fontSize: 20, fontWeight: "600" },
    label: { color: tokens.foreground, fontSize: 17, fontWeight: "600" },
    body: { color: tokens.foreground, fontSize: 15, lineHeight: 23 },
    caption: { color: tokens.mutedForeground, fontSize: 13, lineHeight: 20 },
    error: { color: tokens.destructive, fontSize: 15, lineHeight: 23 },
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
