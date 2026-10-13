import type {
  FinanceManualAccount,
  FinancePortfolioAccountDetail,
  FinancePortfolioCommand,
  FinancePortfolioPreview,
  FinancePortfolioTradeInput,
  FinanceWorkspaceOverview,
} from "@marketbot/contracts";
import {
  FINANCE_TRADE_CSV_HEADER,
  FinancePortfolioAccountDetailSchema,
  FinancePortfolioAccountsSchema,
  FinancePortfolioCommandResultSchema,
  FinancePortfolioCommandSchema,
  FinancePortfolioPreviewSchema,
  parseFinanceTradeCsv,
} from "@marketbot/contracts";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { useMobileTokens, useThemedStyles } from "../lib/native";
import { useFinanceIntent, useFinanceSession } from "../lib/use-finance-session";
import { errorText } from "../lib/user-error";
import { MenuPicker } from "./menu-picker";
import { NativeActionButton } from "./native-action-button";

export function FinancialPortfolio({
  data,
  refreshKey,
  onChanged,
}: {
  data: FinanceWorkspaceOverview;
  refreshKey: number;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const tokens = useMobileTokens();
  const [accounts, setAccounts] = useState<FinanceManualAccount[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [detail, setDetail] = useState<FinancePortfolioAccountDetail | null>(null);
  const [pending, setPending] = useState<FinancePortfolioCommand | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [market, setMarket] = useState("cn");
  const [eventDate, setEventDate] = useState("");
  const [direction, setDirection] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [csv, setCsv] = useState("");
  const [records, setRecords] = useState<FinancePortfolioTradeInput[] | null>(null);
  const [preview, setPreview] = useState<FinancePortfolioPreview | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const alive = useRef(true);
  const generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const session = useFinanceSession(setError);
  const storageKey = useFinanceIntent(
    session,
    "portfolio",
    FinancePortfolioCommandSchema,
    setPending,
    setError,
    t("无法恢复记账操作"),
  );

  useEffect(() => {
    if (!session?.isCurrent()) return;
    let cancelled = false;
    setLoading(true);
    void session!
      .request("finance/portfolioAccounts", {})
      .then((raw) => {
        const next = FinancePortfolioAccountsSchema.parse(raw).accounts;
        if (!cancelled && session!.isCurrent()) {
          setAccounts(next);
          setAccountId((current) =>
            current && next.some((account) => account.id === current)
              ? current
              : (next[0]?.id ?? null),
          );
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled && session!.isCurrent()) setError(errorText(failure, t("无法读取记账账户")));
      })
      .finally(() => {
        if (!cancelled && session!.isCurrent()) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry, refreshKey, t]);
  useEffect(() => {
    if (!session?.isCurrent()) return;
    let cancelled = false;
    generation.current += 1;
    setDetail(null);
    setPreview(null);
    setRecords(null);
    setExpandedHistory(false);
    if (accountId)
      void session!
        .request("finance/portfolioAccount", { accountId })
        .then((raw) => {
          const value = FinancePortfolioAccountDetailSchema.parse(raw);
          if (value.account.id !== accountId) throw new Error("Unexpected account");
          if (!cancelled && session!.isCurrent()) setDetail(value);
        })
        .catch((failure: unknown) => {
          if (!cancelled && session!.isCurrent())
            setError(errorText(failure, t("无法读取记账明细")));
        });
    return () => {
      cancelled = true;
    };
  }, [session, accountId, retry, refreshKey, t]);
  async function clear() {
    if (!session?.isCurrent() || !storageKey) throw new Error("Financial session changed");
    await session.clear(storageKey);
    setPending(null);
    setMissing(false);
  }
  async function applied(raw: unknown, command: FinancePortfolioCommand) {
    const receipt = FinancePortfolioCommandResultSchema.parse(raw);
    if (
      receipt.commandType !== command.commandType ||
      receipt.idempotencyKey !== command.idempotencyKey
    )
      throw new Error("Receipt mismatch");
    if (
      command.commandType !== "portfolio.account.create" &&
      "accountId" in receipt.result &&
      receipt.result.accountId !== command.accountId
    )
      throw new Error("Account receipt mismatch");
    if (!alive.current || !session?.isCurrent()) return;
    await clear();
    if (!session?.isCurrent()) return;
    setError(null);
    setPreview(null);
    setRecords(null);
    if (receipt.commandType === "portfolio.account.create") {
      setAccountId(receipt.result.account.id);
      setName("");
      setShowCreate(false);
    } else if (receipt.commandType === "portfolio.cash.record") {
      setAmount("");
      setCashNote("");
    } else setCsv("");
    setRetry((value) => value + 1);
    onChanged();
  }
  async function send(raw: FinancePortfolioCommand) {
    if (!storageKey || busy || !session?.isCurrent()) return;
    const checked = FinancePortfolioCommandSchema.safeParse(raw);
    if (!checked.success) {
      setError(t("请检查日期、币种和小数格式"));
      return;
    }
    const command = checked.data;
    setBusy(true);
    setError(null);
    setMissing(false);
    try {
      await session!.persist(storageKey, JSON.stringify(command));
    } catch {
      if (!session?.isCurrent()) return;
      setError(t("无法保存操作编号，本次记账未发送。"));
      setBusy(false);
      return;
    }
    if (!alive.current || !session?.isCurrent()) return;
    setPending(command);
    try {
      await applied(await session!.request("finance/portfolioCommand", command), command);
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      if (!alive.current || !session?.isCurrent()) return;
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
        setRetry((value) => value + 1);
        setError(errorText(failure, t("操作未应用，请刷新并重新预览。")));
      } else setError(t("操作结果尚未确认，请先查询原操作。"));
    } finally {
      if (alive.current && session?.isCurrent()) setBusy(false);
    }
  }
  async function query() {
    if (!pending || busy || !session?.isCurrent()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await session!.request("finance/portfolioCommandStatus", {
        commandType: pending.commandType,
        idempotencyKey: pending.idempotencyKey,
      });
      if (!alive.current || !session?.isCurrent()) return;
      if (result) await applied(result, pending);
      else setMissing(true);
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      if (alive.current && session?.isCurrent())
        setError(errorText(failure, t("无法查询原记账操作")));
    } finally {
      if (alive.current && session?.isCurrent()) setBusy(false);
    }
  }
  const supported = data.capabilities.supportedCommands;
  const canCreate = supported.includes("portfolio.account.create");
  const canCash = supported.includes("portfolio.cash.record");
  const canImport = supported.includes("portfolio.trades.import");
  const disabled = busy || !!pending || !storageKey;
  const newKey = () =>
    `portfolio:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`;
  function createAccount() {
    if (!canCreate || disabled) return;
    const checked = FinancePortfolioCommandSchema.safeParse({
      commandType: "portfolio.account.create",
      idempotencyKey: newKey(),
      name,
      market,
      currency: market === "cn" ? "CNY" : "USDT",
    });
    if (!checked.success) {
      setError(t("请填写账户名称并选择市场"));
      return;
    }
    void send(checked.data);
  }
  function recordCash() {
    if (!canCash || disabled || !detail) return;
    const checked = FinancePortfolioCommandSchema.safeParse({
      commandType: "portfolio.cash.record",
      idempotencyKey: newKey(),
      accountId: detail.account.id,
      expectedRevision: detail.account.revision,
      eventDate,
      direction,
      amount: amount.trim(),
      currency: detail.account.currency,
      note: cashNote,
    });
    if (!checked.success) {
      setError(t("请填写真实流水日期和金额，金额使用普通小数"));
      return;
    }
    void send(checked.data);
  }
  function updateCsv(value: string) {
    generation.current += 1;
    setCsv(value);
    setPreview(null);
    setRecords(null);
  }
  async function previewTrades() {
    if (!canImport || disabled || !detail || !session?.isCurrent()) return;
    const currentGeneration = generation.current;
    const account = detail.account;
    setBusy(true);
    setError(null);
    setPreview(null);
    setRecords(null);
    try {
      const values = parseFinanceTradeCsv(csv);
      const value = FinancePortfolioPreviewSchema.parse(
        await session!.request("finance/portfolioPreview", {
          accountId: account.id,
          expectedRevision: account.revision,
          records: values,
        }),
      );
      if (value.accountId !== account.id || value.revision !== account.revision)
        throw new Error("Preview receipt mismatch");
      if (!alive.current || !session?.isCurrent() || currentGeneration !== generation.current)
        return;
      setRecords(values);
      setPreview(value);
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      if (alive.current && session?.isCurrent())
        setError(errorText(failure, t("无法预览交易，请检查模板或刷新账户")));
    } finally {
      if (alive.current && session?.isCurrent()) setBusy(false);
    }
  }
  function commit() {
    if (
      disabled ||
      !canImport ||
      !detail ||
      !records ||
      !preview?.canCommit ||
      preview.accountId !== detail.account.id ||
      preview.revision !== detail.account.revision
    )
      return;
    void send({
      commandType: "portfolio.trades.import",
      idempotencyKey: newKey(),
      accountId: detail.account.id,
      expectedRevision: detail.account.revision,
      records,
      previewHash: preview.previewHash,
    });
  }
  async function copyTemplate() {
    try {
      if (await Clipboard.setStringAsync(`${FINANCE_TRADE_CSV_HEADER}\n`)) setCopied(true);
      else throw new Error("Clipboard unavailable");
    } catch {
      setError(t("无法复制模板，可以选中表头手动复制。"));
    }
  }
  const warnings = (code: string) =>
    (
      ({
        manual_ledger_legacy_float: t("金额与数量沿用原系统浮点存储"),
        legacy_float_storage: t("金额与数量沿用原系统浮点存储"),
        available_cash_unverified: t("可用余额尚未验证"),
        valuation_not_loaded: t("实时市值尚未接入"),
        portfolio_oversell: t("卖出数量超过截至该日的持仓，请补录之前的买入或修正卖出数量"),
        portfolio_uid_conflict: t("同一原始交易编号对应不同内容，请核对原单号和字段"),
        portfolio_external_id_invalid: t("请填写有效的原始交易编号"),
        portfolio_date_invalid: t("日期无效，请使用原始交易日期 YYYY-MM-DD"),
        portfolio_asset_currency_mismatch: t("交易市场或币种与所选账户不一致"),
        portfolio_asset_invalid: t("标的代码无效，请核对市场及原始代码"),
        portfolio_decimal_invalid: t("金额或数量格式无效，请使用普通小数"),
        portfolio_quantity_invalid: t("A 股交易数量必须是正整数"),
        portfolio_decimal_not_representable: t("该小数无法在当前账本中准确保存，请核对原始记录"),
        portfolio_quantity_below_legacy_precision: t("数量低于当前账本可保存的精度"),
        possible_duplicate_economic_rows: t("不同交易编号包含相同经济字段，请核对是否为真实拆单"),
        valuation_unavailable: t("实时市值尚未接入"),
        cash_ledger_net_not_available_cash: t("资金流水净额不含交易支出，不能作为可用余额"),
      }) as Record<string, string>
    )[code] ?? t("该记录未通过校验，请核对原始交易与模板字段");
  if (!session) return <Text accessibilityRole="alert">{error ?? t("正在确认金融会话…")}</Text>;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t("维护记账账户")}</Text>
      <Text style={styles.caption}>
        {t("记录实际交易与资金流水。记账沿用原浮点存储，可用余额与实时市值尚未验证。")}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {pending ? (
        <View style={styles.group}>
          <Text style={styles.caption}>{t("原操作结果待确认")}</Text>
          <NativeActionButton
            label={t("查询原记账操作")}
            disabled={busy}
            prominence="secondary"
            onPress={() => void query()}
          />
          {missing ? (
            <NativeActionButton
              label={t("按原编号重试记账")}
              disabled={busy}
              prominence="secondary"
              onPress={() => void send(pending)}
            />
          ) : null}
        </View>
      ) : null}
      <NativeActionButton
        label={t("刷新记账账户")}
        disabled={busy || loading}
        prominence="secondary"
        onPress={() => {
          setError(null);
          setRetry((value) => value + 1);
        }}
      />
      {loading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
      {canCreate ? (
        <>
          <NativeActionButton
            label={showCreate ? t("收起新账户表单") : t("新建记账账户")}
            disabled={disabled}
            prominence="secondary"
            onPress={() => setShowCreate(!showCreate)}
          />
          {showCreate ? (
            <View style={styles.group}>
              <Field
                label={t("账户名称")}
                value={name}
                onChange={setName}
                disabled={disabled}
                maxLength={64}
              />
              <View pointerEvents={disabled ? "none" : "auto"}>
                <MenuPicker
                  label={t("账户市场与币种")}
                  value={market}
                  choices={[
                    { key: "cn", label: t("A 股 · CNY") },
                    { key: "crypto", label: t("加密现货 · USDT") },
                  ]}
                  onChange={setMarket}
                />
              </View>
              <NativeActionButton
                label={t("创建记账账户")}
                disabled={disabled || !name.trim()}
                onPress={createAccount}
              />
            </View>
          ) : null}
        </>
      ) : null}
      {accounts.length ? (
        <View pointerEvents={disabled ? "none" : "auto"}>
          <MenuPicker
            label={t("助手创建的记账账户")}
            value={String(accountId ?? "")}
            choices={accounts.map((account) => ({
              key: String(account.id),
              label: `${account.name} · ${account.currency}`,
            }))}
            onChange={(value) => {
              generation.current += 1;
              setAccountId(Number(value));
            }}
          />
        </View>
      ) : !loading ? (
        <Text style={styles.caption}>
          {t("尚无助手创建的记账账户。原账户仍在上方按快照只读展示。")}
        </Text>
      ) : null}
      {detail ? (
        <>
          <View style={styles.group}>
            <Text style={styles.label}>
              {detail.account.name} · {detail.account.currency}
            </Text>
            <Text style={styles.body}>
              {t("可用余额")} · {t("未知")}
            </Text>
            <Text selectable style={styles.body}>
              {t("资金流水净额")} · {detail.cashLedgerNet} {detail.account.currency}
            </Text>
            <Text style={styles.caption}>
              {t("仅统计入金与出金，不含交易支出，不能作为可用余额。")}
            </Text>
            {detail.holdings.map((holding) => (
              <Text selectable style={styles.body} key={holding.assetId}>
                {holding.symbol} · {t("数量")} {holding.quantity} · {t("市值未知")}
              </Text>
            ))}
            {detail.warnings.map((warning) => (
              <Text style={styles.caption} key={warning}>
                {warnings(warning)}
              </Text>
            ))}
          </View>
          {canCash ? (
            <View style={styles.group}>
              <Text style={styles.label}>{t("记录资金流水")}</Text>
              <Field
                label={t("流水日期 YYYY-MM-DD")}
                value={eventDate}
                onChange={setEventDate}
                maxLength={10}
                disabled={disabled}
              />
              <View pointerEvents={disabled ? "none" : "auto"}>
                <MenuPicker
                  label={t("流水方向")}
                  value={direction}
                  choices={[
                    { key: "deposit", label: t("入金") },
                    { key: "withdraw", label: t("出金") },
                  ]}
                  onChange={setDirection}
                />
              </View>
              <Field
                label={`${t("流水金额")} · ${detail.account.currency}`}
                value={amount}
                onChange={setAmount}
                maxLength={64}
                disabled={disabled}
              />
              <Field
                label={t("流水备注（可留空）")}
                value={cashNote}
                onChange={setCashNote}
                maxLength={255}
                disabled={disabled}
              />
              <NativeActionButton
                label={t("保存资金流水")}
                disabled={disabled || !eventDate.trim() || !amount.trim()}
                onPress={recordCash}
              />
            </View>
          ) : null}
          {canImport ? (
            <View style={styles.group}>
              <Text style={styles.label}>{t("粘贴交易 CSV")}</Text>
              <Text style={styles.caption}>
                {t(
                  "交易编号使用原成交的唯一编号；日期 YYYY-MM-DD，市场 A股/加密，币种 CNY/USDT，方向 买入/卖出。数量、价格和费用填写普通小数。",
                )}
              </Text>
              <Text selectable style={styles.caption}>
                {FINANCE_TRADE_CSV_HEADER}
              </Text>
              <NativeActionButton
                label={copied ? t("表头已复制") : t("复制交易模板表头")}
                prominence="secondary"
                onPress={() => void copyTemplate()}
              />
              <TextInput
                style={[styles.input, styles.multiline]}
                value={csv}
                onChangeText={updateCsv}
                editable={!disabled}
                multiline
                maxLength={524288}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t("交易 CSV 内容")}
                placeholder={`${FINANCE_TRADE_CSV_HEADER}\n${t("填写你的实际交易记录，预览不会写入账户")}`}
                placeholderTextColor={tokens.mutedForeground}
              />
              <NativeActionButton
                label={t("预览交易导入")}
                disabled={disabled || !csv.trim()}
                prominence="secondary"
                onPress={() => void previewTrades()}
              />
              {preview ? (
                <View style={styles.field}>
                  <Text style={styles.label}>
                    {t("导入预览")} · {t("新增")} {preview.insertCount} · {t("重复")}{" "}
                    {preview.duplicateCount}
                  </Text>
                  {preview.warnings.map((warning) => (
                    <Text style={styles.caption} key={warning}>
                      {warnings(warning)}
                    </Text>
                  ))}
                  {preview.rows.slice(0, 50).map((row) => (
                    <View style={styles.previewRow} key={row.index}>
                      <Text style={styles.body}>
                        {t("第")} {row.index + 2} {t("行")} ·{" "}
                        {
                          {
                            insert: t("新增"),
                            duplicate: t("已存在"),
                            conflict: t("内容冲突"),
                            invalid: t("无效"),
                          }[row.status]
                        }
                        {row.record
                          ? ` · ${row.record.symbol} · ${row.record.side === "buy" ? t("买入") : t("卖出")} ${row.record.quantity} @ ${row.record.price} ${row.record.currency}`
                          : ""}
                      </Text>
                      {row.error ? <Text style={styles.error}>{warnings(row.error)}</Text> : null}
                    </View>
                  ))}
                  {preview.rows.length > 50 ? (
                    <Text style={styles.caption}>
                      {t("仅展示前 50 行；全部行已在服务端校验。")}
                    </Text>
                  ) : null}
                  <NativeActionButton
                    label={t("确认导入已预览交易")}
                    disabled={disabled || !preview.canCommit || !records}
                    onPress={commit}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
          <NativeActionButton
            label={expandedHistory ? t("收起记账历史") : t("查看记账历史")}
            prominence="secondary"
            onPress={() => setExpandedHistory(!expandedHistory)}
          />
          {expandedHistory ? (
            <View style={styles.group}>
              <Text style={styles.label}>{t("交易记录")}</Text>
              {detail.trades.slice(0, 50).map((trade) => (
                <Text selectable style={styles.body} key={trade.id}>
                  {trade.tradeDate} · {trade.symbol} ·{" "}
                  {trade.side === "buy" ? t("买入") : t("卖出")} {trade.quantity} @ {trade.price}{" "}
                  {trade.currency} · {trade.externalId}
                </Text>
              ))}
              <Text style={styles.label}>{t("资金流水")}</Text>
              {detail.cashEntries.slice(0, 50).map((entry) => (
                <Text selectable style={styles.body} key={entry.id}>
                  {entry.eventDate} · {entry.direction === "deposit" ? t("入金") : t("出金")}{" "}
                  {entry.amount} {entry.currency} · {entry.note}
                </Text>
              ))}
              {detail.historyTruncated ||
              detail.trades.length > 50 ||
              detail.cashEntries.length > 50 ? (
                <Text style={styles.caption}>
                  {t("此处只展示最近部分历史，不能据此重算完整账户资金。")}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
function Field({
  label,
  value,
  onChange,
  maxLength,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  disabled: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.caption}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        editable={!disabled}
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
    section: { gap: 16, marginTop: 8, marginBottom: 24 },
    field: { gap: 10 },
    group: {
      gap: 14,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.border,
      borderRadius: 12,
    },
    previewRow: {
      gap: 4,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.border,
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
    multiline: { minHeight: 160, paddingVertical: 12, textAlignVertical: "top" },
  });
}
