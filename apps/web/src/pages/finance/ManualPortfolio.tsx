import { Trans, useLingui } from "@lingui/react/macro";
import type {
  FinancePortfolioAccountDetail,
  FinancePortfolioCommand,
  FinancePortfolioPreview,
  FinancePortfolioTradeInput,
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
import {
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@marketbot/ui-web";
import { useEffect, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

type ManualPortfolioProps = {
  userId?: string;
  onChanged: () => void;
  refreshKey: number;
};

/** Manual records use the financial service's existing ledger, never a client balance. */
export function ManualPortfolio(props: ManualPortfolioProps) {
  return <ManualPortfolioWorkspace key={props.userId ?? "unidentified"} {...props} />;
}

function ManualPortfolioWorkspace({ userId, onChanged, refreshKey }: ManualPortfolioProps) {
  const { t } = useLingui();
  const [accounts, setAccounts] = useState<ReturnType<
    typeof FinancePortfolioAccountsSchema.parse
  > | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [detail, setDetail] = useState<FinancePortfolioAccountDetail | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<FinancePortfolioCommand | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [checkedMissing, setCheckedMissing] = useState(false);
  const [name, setName] = useState("");
  const [market, setMarket] = useState<"cn" | "crypto">("cn");
  const [csv, setCsv] = useState("");
  const [records, setRecords] = useState<FinancePortfolioTradeInput[] | null>(null);
  const [preview, setPreview] = useState<FinancePortfolioPreview | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [direction, setDirection] = useState<"deposit" | "withdraw">("deposit");
  const [cashNote, setCashNote] = useState("");
  const alive = useRef(true);
  const inputGeneration = useRef(0);
  const storageKey = userId ? `finance.portfolio.${userId}` : null;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setStorageReady(false);
    if (!storageKey) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      setPending(saved ? FinancePortfolioCommandSchema.parse(JSON.parse(saved)) : null);
      setStorageReady(true);
    } catch {
      setError(t`无法恢复操作记录，暂不能写入记账账户`);
    }
  }, [storageKey, t]);
  useEffect(() => {
    let cancelled = false;
    void rpc.finance
      .portfolioAccounts({})
      .then((value) => {
        const parsed = FinancePortfolioAccountsSchema.parse(value);
        if (!cancelled) {
          setAccounts(parsed);
          setAccountId((current) =>
            current && parsed.accounts.some((item) => item.id === current)
              ? current
              : (parsed.accounts[0]?.id ?? null),
          );
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(errorText(failure, t`无法读取记账账户`));
      });
    return () => {
      cancelled = true;
    };
  }, [revision, refreshKey, t]);
  useEffect(() => {
    let cancelled = false;
    inputGeneration.current += 1;
    setDetail(null);
    setPreview(null);
    setRecords(null);
    if (accountId) {
      void rpc.finance
        .portfolioAccount({ accountId })
        .then((value) => {
          if (!cancelled) setDetail(FinancePortfolioAccountDetailSchema.parse(value));
        })
        .catch((failure: unknown) => {
          if (!cancelled) setError(errorText(failure, t`无法读取记账明细`));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [accountId, revision, refreshKey, t]);

  function clearPending() {
    if (storageKey) sessionStorage.removeItem(storageKey);
    setPending(null);
    setCheckedMissing(false);
  }
  function applied(command: FinancePortfolioCommand, raw: unknown) {
    const result = FinancePortfolioCommandResultSchema.parse(raw);
    if (
      result.commandType !== command.commandType ||
      result.idempotencyKey !== command.idempotencyKey
    )
      throw new Error("Unexpected receipt");
    if (!alive.current) return;
    clearPending();
    setError(null);
    setPreview(null);
    if (result.commandType === "portfolio.account.create") {
      setAccountId(result.result.account.id);
      setName("");
    }
    setRevision((value) => value + 1);
    onChanged();
  }
  async function send(command: FinancePortfolioCommand) {
    if (!storageKey || !storageReady || busy) return;
    const parsed = FinancePortfolioCommandSchema.safeParse(command);
    if (!parsed.success) {
      setError(t`请检查日期、币种和小数格式`);
      return;
    }
    setBusy(true);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(parsed.data));
    } catch {
      setError(t`无法保存操作编号，本次操作未发送`);
      setBusy(false);
      return;
    }
    setPending(parsed.data);
    setCheckedMissing(false);
    setError(null);
    try {
      applied(parsed.data, await rpc.finance.portfolioCommand(parsed.data));
    } catch (failure: unknown) {
      if (!alive.current) return;
      const code =
        failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (["BAD_REQUEST", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(code)) {
        clearPending();
        setRevision((value) => value + 1);
        setError(errorText(failure, t`操作未应用，请重新预览`));
      } else setError(t`操作结果待确认，请先查询原操作`);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function queryPending() {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await rpc.finance.portfolioCommandStatus({
        commandType: pending.commandType,
        idempotencyKey: pending.idempotencyKey,
      });
      if (!alive.current) return;
      if (result) applied(pending, result);
      else setCheckedMissing(true);
    } catch (failure: unknown) {
      if (alive.current) setError(errorText(failure, t`无法确认原操作`));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function previewTrades() {
    if (!detail || busy || pending) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    setRecords(null);
    const generation = inputGeneration.current;
    try {
      const inputRecords = parseFinanceTradeCsv(csv);
      const result = FinancePortfolioPreviewSchema.parse(
        await rpc.finance.portfolioPreview({
          accountId: detail.account.id,
          expectedRevision: detail.account.revision,
          records: inputRecords,
        }),
      );
      if (!alive.current || generation !== inputGeneration.current) return;
      setRecords(inputRecords);
      setPreview(result);
    } catch (failure: unknown) {
      if (alive.current) setError(errorText(failure, t`无法预览交易，请检查模板或刷新账户`));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function updateCsv(value: string) {
    setCsv(value);
    setPreview(null);
    setRecords(null);
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${FINANCE_TRADE_CSV_HEADER}\n`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "交易导入模板.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  const disabled = busy || !!pending || !storageReady;
  const warningText = (code: string) =>
    (
      ({
        manual_ledger_legacy_float: t`金额与数量沿用原系统浮点存储`,
        available_cash_unverified: t`可用余额尚未验证`,
        valuation_not_loaded: t`实时市值尚未接入`,
        portfolio_oversell: t`卖出数量超过截至该日的持仓，请补录之前的买入或修正卖出数量`,
        portfolio_uid_conflict: t`同一原始交易编号对应不同内容，请核对原单号和字段`,
        portfolio_external_id_invalid: t`请填写有效的原始交易编号`,
        portfolio_date_invalid: t`日期无效，请使用原始交易日期 YYYY-MM-DD`,
        portfolio_asset_currency_mismatch: t`交易市场或币种与所选账户不一致`,
        portfolio_asset_invalid: t`标的代码无效，请核对市场及原始代码`,
        portfolio_decimal_invalid: t`金额或数量格式无效，请使用普通小数`,
        portfolio_quantity_invalid: t`A 股交易数量必须是正整数`,
        portfolio_decimal_not_representable: t`该小数无法在当前账本中准确保存，请核对原始记录`,
        portfolio_quantity_below_legacy_precision: t`数量低于当前账本可保存的精度`,
        possible_duplicate_economic_rows: t`不同交易编号包含相同经济字段，请核对是否为真实拆单`,
      }) as Record<string, string>
    )[code] ?? t`该记录未通过校验，请核对原始交易与模板字段`;
  return (
    <section className="mt-8 border-t pt-6">
      <h2 className="text-base font-medium">
        <Trans>维护记账账户</Trans>
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <Trans>
          记录实际发生的交易与资金流水。记账账户沿用原 Float 存储，可用余额与实时市值尚未验证。
        </Trans>
      </p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {pending ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm">
            <Trans>原操作结果待确认</Trans>
          </span>
          <Button variant="secondary" disabled={busy} onClick={() => void queryPending()}>
            <Trans>查询原操作</Trans>
          </Button>
          {checkedMissing ? (
            <Button disabled={busy} onClick={() => void send(pending)}>
              <Trans>按原编号重试</Trans>
            </Button>
          ) : null}
        </div>
      ) : null}
      {accounts ? (
        <>
          {accounts.accounts.length ? (
            <div className="mt-4 max-w-sm space-y-2">
              <Label htmlFor="manual-account">
                <Trans>记账账户</Trans>
              </Label>
              <NativeSelect
                id="manual-account"
                value={String(accountId ?? "")}
                disabled={busy || !!pending}
                onChange={(event) => setAccountId(Number(event.target.value))}
              >
                {accounts.accounts.map((account) => (
                  <NativeSelectOption key={account.id} value={String(account.id)}>
                    {account.name} · {account.currency}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              <Trans>还没有记账账户</Trans>
            </p>
          )}
          <details className="mt-4">
            <summary className="cursor-pointer py-2 text-sm">
              <Trans>新建记账账户</Trans>
            </summary>
            <div className="mt-3 grid max-w-xl gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-name">
                  <Trans>账户名称</Trans>
                </Label>
                <Input
                  id="manual-name"
                  value={name}
                  maxLength={64}
                  disabled={disabled}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-market">
                  <Trans>市场</Trans>
                </Label>
                <NativeSelect
                  id="manual-market"
                  value={market}
                  disabled={disabled}
                  onChange={(event) => setMarket(event.target.value as "cn" | "crypto")}
                >
                  <NativeSelectOption value="cn">
                    <Trans>A 股 · CNY</Trans>
                  </NativeSelectOption>
                  <NativeSelectOption value="crypto">
                    <Trans>现货 · USDT</Trans>
                  </NativeSelectOption>
                </NativeSelect>
              </div>
              <Button
                className="justify-self-start"
                disabled={disabled || !name.trim()}
                onClick={() =>
                  void send({
                    commandType: "portfolio.account.create",
                    idempotencyKey: crypto.randomUUID(),
                    name: name.trim(),
                    market,
                    currency: market === "cn" ? "CNY" : "USDT",
                  })
                }
              >
                <Trans>创建账户</Trans>
              </Button>
            </div>
          </details>
        </>
      ) : !error ? (
        <p className="mt-4 text-sm text-muted-foreground">
          <Trans>正在读取记账账户</Trans>
        </p>
      ) : null}
      {detail ? (
        <div className="mt-6 space-y-6">
          <div className="text-sm">
            <Trans>资金流水净额</Trans> {detail.cashLedgerNet} {detail.account.currency} ·{" "}
            <Trans>可用余额未知</Trans>
            <p className="mt-1 text-xs text-muted-foreground">
              <Trans>资金流水净额仅统计入金减出金，不含交易支出。</Trans>
            </p>
          </div>
          {detail.holdings.length ? (
            <ul className="divide-y text-sm">
              {detail.holdings.map((holding) => (
                <li key={holding.assetId} className="flex items-center justify-between gap-4 py-3">
                  <span>{holding.symbol}</span>
                  <span className="tabular-nums">
                    <Trans>数量</Trans> {holding.quantity}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Trans>暂无记账持仓</Trans>
            </p>
          )}
          <details>
            <summary className="cursor-pointer py-2 text-sm">
              <Trans>记录入金或出金</Trans>
            </summary>
            <div className="mt-3 grid max-w-xl gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cash-date">
                  <Trans>发生日期</Trans>
                </Label>
                <Input
                  id="cash-date"
                  type="date"
                  value={eventDate}
                  disabled={disabled}
                  onChange={(event) => setEventDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-direction">
                  <Trans>方向</Trans>
                </Label>
                <NativeSelect
                  id="cash-direction"
                  value={direction}
                  disabled={disabled}
                  onChange={(event) => setDirection(event.target.value as "deposit" | "withdraw")}
                >
                  <NativeSelectOption value="deposit">
                    <Trans>入金</Trans>
                  </NativeSelectOption>
                  <NativeSelectOption value="withdraw">
                    <Trans>出金</Trans>
                  </NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-amount">
                  <Trans>金额</Trans> · {detail.account.currency}
                </Label>
                <Input
                  id="cash-amount"
                  inputMode="decimal"
                  value={cashAmount}
                  disabled={disabled}
                  onChange={(event) => setCashAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-note">
                  <Trans>备注</Trans>
                </Label>
                <Input
                  id="cash-note"
                  value={cashNote}
                  maxLength={255}
                  disabled={disabled}
                  onChange={(event) => setCashNote(event.target.value)}
                />
              </div>
              <Button
                className="justify-self-start"
                disabled={disabled || !eventDate || !cashAmount}
                onClick={() =>
                  void send({
                    commandType: "portfolio.cash.record",
                    idempotencyKey: crypto.randomUUID(),
                    accountId: detail.account.id,
                    expectedRevision: detail.account.revision,
                    eventDate,
                    direction,
                    amount: cashAmount.trim(),
                    currency: detail.account.currency,
                    note: cashNote,
                  })
                }
              >
                <Trans>保存流水</Trans>
              </Button>
            </div>
          </details>
          <details>
            <summary className="cursor-pointer py-2 text-sm">
              <Trans>导入交易记录</Trans>
            </summary>
            <div className="mt-3 space-y-4">
              <p className="text-sm text-muted-foreground">
                <Trans>
                  使用模板填写已发生的买卖。交易编号用于查重；同编号内容变更会阻止导入。
                </Trans>
              </p>
              <Button variant="secondary" onClick={downloadTemplate}>
                <Trans>下载交易模板</Trans>
              </Button>
              <div className="space-y-2">
                <Label htmlFor="trade-csv-file">
                  <Trans>选择 CSV 文件</Trans>
                </Label>
                <input
                  id="trade-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={disabled}
                  className="block max-w-full text-sm"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 512 * 1024) {
                      setError(t`文件超过 512 KiB，请拆分导入`);
                      return;
                    }
                    void file
                      .text()
                      .then((value) => {
                        if (alive.current) updateCsv(value);
                      })
                      .catch(() => {
                        if (alive.current) setError(t`无法读取交易文件`);
                      });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade-csv">
                  <Trans>或粘贴模板内容</Trans>
                </Label>
                <Textarea
                  id="trade-csv"
                  value={csv}
                  maxLength={512 * 1024}
                  rows={5}
                  disabled={disabled}
                  onChange={(event) => updateCsv(event.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                disabled={disabled || !csv.trim()}
                onClick={() => void previewTrades()}
              >
                <Trans>预览与查重</Trans>
              </Button>
              {preview ? (
                <div className="space-y-4">
                  <p className="text-sm">
                    <Trans>待导入</Trans> {preview.insertCount} · <Trans>重复跳过</Trans>{" "}
                    {preview.duplicateCount}
                  </p>
                  <section
                    className="max-h-80 overflow-auto rounded-md border"
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: This scrollable preview must be reachable by keyboard.
                    tabIndex={0}
                    aria-label={t`交易导入预览`}
                  >
                    <table className="w-full whitespace-nowrap text-left text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr>
                          <th className="p-3">
                            <Trans>行</Trans>
                          </th>
                          <th className="p-3">
                            <Trans>标的</Trans>
                          </th>
                          <th className="p-3">
                            <Trans>状态</Trans>
                          </th>
                          <th className="p-3">
                            <Trans>说明</Trans>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row) => (
                          <tr key={row.index} className="border-t">
                            <td className="p-3">{row.index + 2}</td>
                            <td className="p-3">{row.record?.symbol ?? "—"}</td>
                            <td className="p-3">
                              {row.status === "insert"
                                ? t`可导入`
                                : row.status === "duplicate"
                                  ? t`重复`
                                  : row.status === "conflict"
                                    ? t`冲突`
                                    : t`不合法`}
                            </td>
                            <td className="p-3">{row.error ? warningText(row.error) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                  {preview.warnings.map((warning) => (
                    <p key={warning} className="text-sm text-muted-foreground">
                      {warningText(warning)}
                    </p>
                  ))}
                  <Button
                    disabled={disabled || !preview.canCommit || !records}
                    onClick={() => {
                      if (records)
                        void send({
                          commandType: "portfolio.trades.import",
                          idempotencyKey: crypto.randomUUID(),
                          accountId: preview.accountId,
                          expectedRevision: preview.revision,
                          previewHash: preview.previewHash,
                          records,
                        });
                    }}
                  >
                    <Trans>确认导入记账账户</Trans>
                  </Button>
                </div>
              ) : null}
            </div>
          </details>
          {detail.trades.length || detail.cashEntries.length ? (
            <details>
              <summary className="cursor-pointer py-2 text-sm">
                <Trans>查看记账流水</Trans>
              </summary>
              <ul className="mt-3 divide-y text-sm">
                {detail.trades.map((trade) => (
                  <li key={`trade-${trade.id}`} className="py-3">
                    {trade.tradeDate} · {trade.symbol} · {trade.side === "buy" ? t`买入` : t`卖出`}{" "}
                    {trade.quantity} × {trade.price} {trade.currency} · <Trans>费用</Trans>{" "}
                    {trade.fee} · <Trans>税费</Trans> {trade.tax}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {trade.externalId}
                      {trade.note ? ` · ${trade.note}` : ""}
                    </span>
                  </li>
                ))}
                {detail.cashEntries.map((entry) => (
                  <li key={`cash-${entry.id}`} className="py-3">
                    {entry.eventDate} · {entry.direction === "deposit" ? t`入金` : t`出金`}{" "}
                    {entry.amount} {entry.currency}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </li>
                ))}
              </ul>
              {detail.historyTruncated ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  <Trans>各类明细最多展示 1000 条，持仓计算使用完整账本。</Trans>
                </p>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
