import { Trans, useLingui } from "@lingui/react/macro";
import type { FinanceRunInputs } from "@marketbot/contracts";
import { FinanceRunInputsSchema } from "@marketbot/contracts";
import { Button } from "@marketbot/ui-web";
import { useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

export function RunInputs({
  runId,
  recordId,
  tradingDate,
}: {
  runId: number;
  recordId: number;
  tradingDate: string;
}) {
  const { t } = useLingui();
  const [value, setValue] = useState<FinanceRunInputs | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  async function load() {
    if (busy) return;
    setOpen(true);
    if (value) return;
    const request = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      const next = FinanceRunInputsSchema.parse(await rpc.finance.runInputs({ runId, recordId }));
      if (
        next.runId !== runId ||
        next.recordId !== recordId ||
        (next.tradingDate !== null && next.tradingDate !== tradingDate)
      )
        throw new Error(t`归档记录与当前交易日不一致。`);
      if (generation.current === request) setValue(next);
    } catch (failure: unknown) {
      if (generation.current === request) setError(errorText(failure, t`无法读取归档行情输入`));
    } finally {
      if (generation.current === request) setBusy(false);
    }
  }
  return (
    <div className="mt-4">
      <Button
        variant="secondary"
        disabled={busy}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : void load())}
      >
        {open ? <Trans>收起行情输入</Trans> : <Trans>查看当时行情输入</Trans>}
      </Button>
      {open ? (
        <div className="mt-4 space-y-4 rounded-lg border border-border p-4">
          <p className="text-xs leading-6 text-muted-foreground">
            <Trans>只读取该交易日归档的输入，不刷新网络行情。价格与成交量沿用原数据单位。</Trans>
          </p>
          {busy ? (
            <p role="status" className="text-sm text-muted-foreground">
              <Trans>正在读取归档…</Trans>
            </p>
          ) : null}
          {error ? (
            <div role="alert" className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="secondary" disabled={busy} onClick={() => void load()}>
                <Trans>重试读取归档</Trans>
              </Button>
            </div>
          ) : null}
          {value ? (
            <>
              <p className="text-xs text-muted-foreground">
                <Trans>截至交易日</Trans> {value.tradingDate ?? "—"} · <Trans>基准收盘原值</Trans>{" "}
                {value.benchmarkClose ?? "—"}
              </p>
              {Object.entries(value.bars).map(([symbol, bars]) => (
                <InputSeries
                  key={symbol}
                  symbol={symbol}
                  bars={bars}
                  source={value.sources[symbol] ?? null}
                />
              ))}
              {!Object.keys(value.bars).length ? (
                <p className="text-sm text-muted-foreground">
                  <Trans>这条记录未保存行情输入。</Trans>
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InputSeries({
  symbol,
  bars,
  source,
}: {
  symbol: string;
  bars: FinanceRunInputs["bars"][string];
  source: string | null;
}) {
  const { t } = useLingui();
  const tableLabel = `${symbol} ${t`归档行情表，可横向滚动`}`;
  const [page, setPage] = useState(0);
  const ordered = useMemo(
    () => bars.slice().sort((a, b) => (b.tradingDate ?? "").localeCompare(a.tradingDate ?? "")),
    [bars],
  );
  const rows = ordered.slice(page * 20, (page + 1) * 20);
  return (
    <section className="space-y-3">
      <h5 className="text-sm font-medium">
        {symbol} · {source ?? <Trans>来源未记录</Trans>}
      </h5>
      <p className="text-xs text-muted-foreground">
        <Trans>归档输入</Trans> {bars.length} · <Trans>第</Trans> {bars.length ? page * 20 + 1 : 0}–
        {Math.min((page + 1) * 20, bars.length)} · <Trans>按交易日由近到远</Trans>
      </p>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the archived quote table. */}
      <section className="overflow-x-auto" aria-label={tableLabel} tabIndex={0}>
        <table className="w-full min-w-[640px] whitespace-nowrap text-start text-xs tabular-nums">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {[
                <Trans key="date">交易日</Trans>,
                <Trans key="open">开盘</Trans>,
                <Trans key="close">收盘</Trans>,
                <Trans key="high">最高</Trans>,
                <Trans key="low">最低</Trans>,
                <Trans key="volume">成交量</Trans>,
                <Trans key="amount">成交额</Trans>,
                <Trans key="precision">开/收盘精度来源</Trans>,
              ].map((label, i) => (
                <th key={String(i)} className="px-2 py-2 text-start font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((bar, index) => (
              <tr key={`${bar.tradingDate}:${index}`} className="border-b border-border">
                <td className="whitespace-nowrap px-2 py-2">{bar.tradingDate ?? "—"}</td>
                {[bar.open, bar.close, bar.high, bar.low, bar.volume, bar.amount].map(
                  (amount, i) => (
                    <td key={String(i)} className="px-2 py-2">
                      {amount ?? "—"}
                    </td>
                  ),
                )}
                <td className="px-2 py-2">
                  {bar.priceInputSource === "provider_decimal" ? (
                    <Trans>原始十进制</Trans>
                  ) : bar.priceInputSource === "normalized_float" ? (
                    <Trans>浮点规范化</Trans>
                  ) : (
                    <Trans>精度来源未记录</Trans>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {ordered.length > 20 ? (
        <div className="flex gap-2">
          <Button variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <Trans>较近输入</Trans>
          </Button>
          <Button
            variant="ghost"
            disabled={(page + 1) * 20 >= ordered.length}
            onClick={() => setPage(page + 1)}
          >
            <Trans>更早输入</Trans>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
