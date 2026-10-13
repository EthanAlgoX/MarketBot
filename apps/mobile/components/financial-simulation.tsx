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
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { useFinanceIntent, useFinanceSession } from "../lib/use-finance-session";
import { errorText } from "../lib/user-error";
import { MenuPicker } from "./menu-picker";
import { NativeActionButton } from "./native-action-button";

export function FinancialSimulation({
  data,
  refreshKey,
  onApplied,
}: {
  data: FinanceWorkspaceOverview;
  refreshKey: number;
  onApplied: (result: FinanceSimulationCommandResult) => void;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [catalog, setCatalog] = useState<FinanceSimulationCatalog | null>(null);
  const [pending, setPending] = useState<FinanceSimulationCommand | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [ruleId, setRuleId] = useState("crypto_btc_hold");
  const [mode, setMode] = useState("paper");
  const [symbols, setSymbols] = useState("");
  const [cash, setCash] = useState("");
  const [commission, setCommission] = useState("0.001");
  const [slippage, setSlippage] = useState("0.0005");
  const [sellTax, setSellTax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const session = useFinanceSession(setError);
  const storageKey = useFinanceIntent(
    session,
    "simulation",
    FinanceSimulationCommandSchema,
    setPending,
    setError,
    t("无法恢复操作记录，暂不能运行模拟"),
  );

  useEffect(() => {
    if (!session?.isCurrent()) return;
    let cancelled = false;
    void session!
      .request("finance/simulationCatalog")
      .then((value) => {
        if (!cancelled && session!.isCurrent()) {
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
        if (!cancelled && session!.isCurrent()) {
          setCatalog(null);
          setError(errorText(failure, t("无法读取模拟规则目录")));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, refreshKey, t]);
  const supported = data.capabilities.supportedCommands;
  const inactive = busy || pending !== null || !storageKey;
  const rules =
    catalog?.rules.filter((rule) => rule.available && catalog.markets.includes(rule.market)) ?? [];
  const canCreate =
    !!catalog?.enabled &&
    supported.includes("simulation.create") &&
    rules.some((rule) => rule.id === ruleId);
  const selectedRule = rules.find((rule) => rule.id === ruleId);

  async function clearIntent() {
    if (!session?.isCurrent() || !storageKey) throw new Error("Financial session changed");
    await session.clear(storageKey);
  }
  async function applied(result: FinanceSimulationCommandResult) {
    await clearIntent();
    if (!session?.isCurrent()) return;
    setPending(null);
    setMissing(false);
    setError(null);
    setStatus(t("操作已应用，运行结果由后台更新。"));
    onApplied(result);
    if (result.commandType === "simulation.create") {
      setName("");
      setCash("");
      setSymbols("");
      setShowCreate(false);
    }
  }
  async function send(command: FinanceSimulationCommand) {
    if (!storageKey || busy || !session?.isCurrent()) return;
    setBusy(true);
    try {
      await session!.persist(storageKey, JSON.stringify(command));
    } catch {
      if (!session?.isCurrent()) return;
      setError(t("无法保存操作编号，本次操作未发送。"));
      setBusy(false);
      return;
    }
    setPending(command);
    setMissing(false);
    setError(null);
    setStatus(null);
    try {
      await applied(
        FinanceSimulationCommandResultSchema.parse(
          await session!.request("finance/simulationCommand", command),
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
        setError(errorText(failure, t("操作未应用，请刷新后再试")));
      } else setError(t("尚未确认操作结果，请先查询；重试会保留原操作编号。"));
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }
  async function check() {
    if (!pending || busy || !session?.isCurrent()) return;
    setBusy(true);
    setError(null);
    try {
      const value = await session!.request("finance/simulationCommandStatus", {
        commandType: pending.commandType,
        idempotencyKey: pending.idempotencyKey,
      });
      if (value) await applied(FinanceSimulationCommandResultSchema.parse(value));
      else {
        setMissing(true);
        setStatus(t("暂未查到结果，可以重试同一操作。"));
      }
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      setError(errorText(failure, t("暂时无法查询，请稍后再查")));
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }
  function create() {
    if (inactive || !canCreate || !selectedRule) return;
    const command = FinanceSimulationCommandSchema.safeParse({
      commandType: "simulation.create",
      idempotencyKey: intentKey(),
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
        t(
          "请检查名称、代码、日期和资金参数。现金需为正数且不超过十亿，A 股最多 2 位小数，加密最多 8 位；各费率需在 0–0.05 之间。",
        ),
      );
      return;
    }
    void send(command.data);
  }
  if (!session) return <Text accessibilityRole="alert">{error ?? t("正在确认金融会话…")}</Text>;
  return (
    <View style={styles.section}>
      <Text style={styles.secondary}>
        {t(
          "内置规则使用日线和模拟资金。后台服务保持运行时，关闭客户端不影响任务。规则参数和费用在创建时冻结，账本中可复查。模拟价格步长为 A 股 0.01、加密 0.00000001，属于模拟假设。",
        )}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {status ? <Text style={styles.secondary}>{status}</Text> : null}
      {pending ? (
        <View style={styles.group}>
          <Text selectable style={styles.caption}>
            {t("待确认操作")} · {pending.commandType} · {pending.idempotencyKey}
          </Text>
          <NativeActionButton
            label={t("查询模拟操作结果")}
            prominence="secondary"
            disabled={busy}
            onPress={() => void check()}
          />
          {missing ? (
            <NativeActionButton
              label={t("重试同一模拟操作")}
              prominence="secondary"
              disabled={busy || !catalog?.enabled || !supported.includes(pending.commandType)}
              onPress={() => void send(pending)}
            />
          ) : null}
        </View>
      ) : null}
      {catalog?.enabled && supported.includes("simulation.create") ? (
        <>
          <NativeActionButton
            label={showCreate ? t("收起模拟表单") : t("创建日线模拟")}
            prominence="secondary"
            onPress={() => setShowCreate(!showCreate)}
          />
          {showCreate ? (
            <View style={styles.group}>
              <Field
                label={t("模拟名称")}
                value={name}
                onChange={setName}
                maxLength={100}
                disabled={inactive}
              />
              <View pointerEvents={inactive ? "none" : "auto"}>
                <MenuPicker
                  label={t("内置规则与市场")}
                  value={ruleId}
                  choices={rules.map((rule) => ({
                    key: rule.id,
                    label: `${rule.name} · ${rule.market === "cn" ? t("A 股") : t("加密现货")}`,
                  }))}
                  onChange={setRuleId}
                />
                <MenuPicker
                  label={t("运行方式")}
                  value={mode}
                  choices={[
                    { key: "paper", label: t("模拟盯盘") },
                    { key: "backtest", label: t("历史回测") },
                  ]}
                  onChange={setMode}
                />
              </View>
              {ruleId !== "crypto_btc_hold" ? (
                <Field
                  label={t("代码（逗号分隔，最多 12 个）")}
                  value={symbols}
                  onChange={setSymbols}
                  maxLength={780}
                  disabled={inactive}
                  placeholder="BTCUSDT, ETHUSDT"
                />
              ) : (
                <Text style={styles.caption}>{t("规则标的：BTCUSDT")}</Text>
              )}
              <Field
                label={
                  selectedRule?.market === "cn"
                    ? t("初始模拟资金（CNY）")
                    : t("初始模拟资金（USDT）")
                }
                value={cash}
                onChange={setCash}
                maxLength={80}
                disabled={inactive}
                decimal
              />
              <Field
                label={t("手续费率（0.001 = 0.1%）")}
                value={commission}
                onChange={setCommission}
                maxLength={80}
                disabled={inactive}
                decimal
              />
              <Field
                label={t("滑点率（0.0005 = 0.05%）")}
                value={slippage}
                onChange={setSlippage}
                maxLength={80}
                disabled={inactive}
                decimal
              />
              {selectedRule?.market === "cn" ? (
                <Field
                  label={t("卖出税率（模拟假设，0–0.05）")}
                  value={sellTax}
                  onChange={setSellTax}
                  maxLength={80}
                  disabled={inactive}
                  decimal
                />
              ) : null}
              {mode === "backtest" ? (
                <>
                  <Field
                    label={t("开始日期（YYYY-MM-DD）")}
                    value={startDate}
                    onChange={setStartDate}
                    maxLength={10}
                    disabled={inactive}
                    placeholder="YYYY-MM-DD"
                  />
                  <Field
                    label={t("结束日期（YYYY-MM-DD）")}
                    value={endDate}
                    onChange={setEndDate}
                    maxLength={10}
                    disabled={inactive}
                    placeholder="YYYY-MM-DD"
                  />
                </>
              ) : null}
              <NativeActionButton
                label={t("创建模拟账户")}
                disabled={inactive || !canCreate || !name.trim() || !cash.trim()}
                onPress={create}
              />
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.caption}>{t("新建模拟暂未开放；已有记录和可用操作仍可查看。")}</Text>
      )}
      {catalog?.rules
        .filter((rule) => !rule.available)
        .map((rule) => (
          <Text key={rule.id} style={styles.caption}>
            {rule.name} ·{" "}
            {rule.reason === "simulation_disabled"
              ? t("尚未启用")
              : rule.reason === "simulation_dependency_unavailable"
                ? t("需要准备行情与运行依赖")
                : rule.reason === "simulation_market_unverified"
                  ? t("市场规则尚未验证")
                  : t("暂不可用")}
          </Text>
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
                "simulation.start": t("启动模拟"),
                "simulation.pause": t("暂停模拟"),
                "simulation.resume": t("继续模拟"),
                "simulation.stop": t("终止模拟"),
                "simulation.run": t("开始回测"),
              };
              return actions.some((action) => supported.includes(action)) ? (
                <View key={run.id} style={styles.group}>
                  <Text style={styles.label}>{run.name}</Text>
                  {actions
                    .filter((action) => supported.includes(action))
                    .map((action) => (
                      <NativeActionButton
                        key={action}
                        label={labels[action] ?? action}
                        prominence="secondary"
                        disabled={inactive}
                        onPress={() =>
                          void send(
                            FinanceSimulationCommandSchema.parse({
                              commandType: action,
                              idempotencyKey: intentKey(),
                              runId: run.id,
                              expectedRevision: run.revision,
                            }),
                          )
                        }
                      />
                    ))}
                  <Text style={styles.caption}>{t("终止后不能继续，需要新建模拟账户。")}</Text>
                </View>
              ) : null;
            })
        : null}
    </View>
  );
}
function Field({
  label,
  value,
  onChange,
  maxLength,
  disabled,
  decimal,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  disabled: boolean;
  decimal?: boolean;
  placeholder?: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.caption}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        editable={!disabled}
        keyboardType={decimal ? "decimal-pad" : "default"}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={native.secondaryLabel}
        style={styles.input}
      />
    </View>
  );
}
function intentKey() {
  return `simulation:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`;
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
    field: { gap: 8 },
    label: { color: tokens.foreground, fontSize: 17, fontWeight: "600" },
    secondary: { color: tokens.mutedForeground, fontSize: 15, lineHeight: 23 },
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
