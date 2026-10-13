import { Trans, useLingui } from "@lingui/react/macro";
import type {
  FinanceWatchlistCommand,
  FinanceWatchlistCommandResult,
  FinanceWorkspaceOverview,
} from "@marketbot/contracts";
import { FinanceWatchlistCommandSchema } from "@marketbot/contracts";
import { Button, Input, Label, NativeSelect, NativeSelectOption } from "@marketbot/ui-web";
import type { FormEvent } from "react";
import { useState } from "react";
import { newClientId } from "../../lib/client-id";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

export function Watchlist({
  data,
  onChanged,
  onRefresh,
  userId,
}: {
  data: FinanceWorkspaceOverview;
  onChanged: (result: FinanceWatchlistCommandResult) => void;
  onRefresh: () => void;
  userId?: string;
}) {
  const { t } = useLingui();
  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState<"cn" | "crypto">("cn");
  const [reason, setReason] = useState("");
  const storageKey = userId ? `finance:watchlist-intent:${userId}` : null;
  const [pending, setPending] = useState<FinanceWatchlistCommand | null>(() => {
    if (!storageKey) return null;
    try {
      const value = sessionStorage.getItem(storageKey);
      return value ? FinanceWatchlistCommandSchema.parse(JSON.parse(value)) : null;
    } catch {
      return null;
    }
  });
  const [busy, setBusy] = useState(false);
  const [checkedMissing, setCheckedMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applied(result: FinanceWatchlistCommandResult) {
    clearStoredIntent();
    onChanged(result);
    setPending(null);
    setCheckedMissing(false);
    setError(null);
    if (result.commandType === "watchlist.add") {
      setSymbol("");
      setReason("");
    }
  }

  function clearStoredIntent() {
    if (!storageKey) return;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* A later visit can query the completed command again. */
    }
  }

  async function send(command: FinanceWatchlistCommand) {
    if (!storageKey) {
      setError(t`账户信息尚未准备好，本次操作未发送。`);
      return;
    }
    if (storageKey) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(command));
      } catch {
        setError(t`无法保存操作编号，本次操作未发送。`);
        return;
      }
    }
    setPending(command);
    setBusy(true);
    setError(null);
    setCheckedMissing(false);
    try {
      applied(await rpc.finance.watchlistCommand(command));
    } catch (failure: unknown) {
      const code =
        failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (["BAD_REQUEST", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(code)) {
        clearStoredIntent();
        setPending(null);
        onRefresh();
        setError(errorText(failure, t`操作未应用，请刷新后再试`));
      } else {
        setError(t`尚未确认操作结果，请先查询；重试会保留原操作编号。`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function checkResult() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await rpc.finance.commandStatus({
        commandType: pending.commandType,
        idempotencyKey: pending.idempotencyKey,
      });
      if (result) applied(result);
      else {
        setCheckedMissing(true);
        setError(t`暂未查到结果，可以重试同一操作。`);
      }
    } catch (failure: unknown) {
      setError(errorText(failure, t`暂时无法查询，请稍后再查`));
    } finally {
      setBusy(false);
    }
  }

  function add(event: FormEvent) {
    event.preventDefault();
    if (pending || busy || !symbol.trim()) return;
    void send({
      commandType: "watchlist.add",
      idempotencyKey: `watchlist:${newClientId()}`,
      expectedRevision: data.watchlistRevision,
      symbol: symbol.trim(),
      market,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
  }

  return (
    <section>
      <h2 className="mb-4 text-base font-semibold">
        <Trans>关注标的</Trans>
      </h2>
      {data.watchlist.length ? (
        <ul className="divide-y divide-border border-y border-border">
          {data.watchlist.map((asset) => (
            <li
              key={asset.assetId}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium">
                  {asset.name || asset.symbol}
                  <span className="ms-3 text-xs font-normal text-muted-foreground">
                    {asset.symbol} · {asset.market.toUpperCase()} · {asset.currency}
                  </span>
                </p>
                {asset.reason ? (
                  <p className="mt-1 text-sm text-muted-foreground">{asset.reason}</p>
                ) : null}
              </div>
              {data.capabilities.supportedCommands.includes("watchlist.remove") &&
              (asset.market === "cn" || asset.market === "crypto") ? (
                <Button
                  variant="ghost"
                  disabled={!storageKey || busy || pending !== null}
                  aria-label={t`移除 ${asset.name || asset.symbol}`}
                  onClick={() =>
                    void send({
                      commandType: "watchlist.remove",
                      idempotencyKey: `watchlist:${newClientId()}`,
                      expectedRevision: data.watchlistRevision,
                      symbol: asset.symbol,
                      market: asset.market as "cn" | "crypto",
                    })
                  }
                >
                  <Trans>移除</Trans>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          <Trans>金融工作区还没有自选标的。</Trans>
        </p>
      )}
      {data.capabilities.supportedCommands.includes("watchlist.add") ? (
        <form onSubmit={add} className="mt-5 flex flex-wrap items-end gap-3">
          <div className="w-32 space-y-2">
            <Label htmlFor="watchlist-market">
              <Trans>市场</Trans>
            </Label>
            <NativeSelect
              id="watchlist-market"
              value={market}
              onChange={(event) => setMarket(event.target.value as "cn" | "crypto")}
              disabled={busy || pending !== null}
            >
              <NativeSelectOption value="cn">
                <Trans>A 股</Trans>
              </NativeSelectOption>
              <NativeSelectOption value="crypto">
                <Trans>加密现货</Trans>
              </NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="min-w-40 flex-1 space-y-2">
            <Label htmlFor="watchlist-symbol">
              <Trans>代码</Trans>
            </Label>
            <Input
              id="watchlist-symbol"
              value={symbol}
              maxLength={64}
              autoComplete="off"
              placeholder={market === "cn" ? "600519" : "BTCUSDT"}
              onChange={(event) => setSymbol(event.target.value)}
              disabled={busy || pending !== null}
              required
            />
          </div>
          <div className="min-w-48 flex-1 space-y-2">
            <Label htmlFor="watchlist-reason">
              <Trans>关注原因（可选）</Trans>
            </Label>
            <Input
              id="watchlist-reason"
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy || pending !== null}
            />
          </div>
          <Button
            type="submit"
            disabled={!storageKey || busy || pending !== null || !symbol.trim()}
          >
            <Trans>加入自选</Trans>
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-warning">
          {error}
        </p>
      ) : null}
      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void checkResult()}>
            <Trans>查询操作结果</Trans>
          </Button>
          {checkedMissing ? (
            <Button variant="secondary" disabled={busy} onClick={() => void send(pending)}>
              <Trans>重试同一操作</Trans>
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
