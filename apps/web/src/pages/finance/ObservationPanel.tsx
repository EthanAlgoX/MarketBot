import { Trans, useLingui } from "@lingui/react/macro";
import type {
  FinanceObservation,
  FinanceObservationInput,
  FinanceResearchRequest,
} from "@marketbot/contracts";
import {
  FinanceObservationInputSchema,
  FinanceObservationSchema,
  financeObservationMatchesInput,
} from "@marketbot/contracts";
import {
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@marketbot/ui-web";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { newClientId } from "../../lib/client-id";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { RuleDraftPanel } from "./RuleDraftPanel";

const listSchema = FinanceObservationSchema.array().max(100);

export function ObservationPanel(props: { userId?: string; tasks: FinanceResearchRequest[] }) {
  return <UserObservations key={props.userId ?? "anonymous"} {...props} />;
}

function UserObservations({ userId, tasks }: { userId?: string; tasks: FinanceResearchRequest[] }) {
  const { t } = useLingui();
  const storageKey = userId ? `finance:observation-intent:${userId}` : null;
  const [items, setItems] = useState<FinanceObservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [requestId, setRequestId] = useState("");
  const [note, setNote] = useState("");
  const [deadline, setDeadline] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const [missing, setMissing] = useState(false);
  const [pending, setPending] = useState<FinanceObservationInput | null>(() => {
    try {
      const raw = storageKey ? sessionStorage.getItem(storageKey) : null;
      return raw ? FinanceObservationInputSchema.parse(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  });
  const completed = tasks.filter(
    (task) => task.status === "succeeded" && task.resultRef && task.result,
  );

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    void rpc.finance
      .observations({})
      .then((raw) => {
        const result = listSchema.parse(raw);
        if (!stopped) setItems(result);
      })
      .catch((failure: unknown) => {
        if (!stopped) setError(errorText(failure, t`观察记录暂时不可用，已有记录仍保留。`));
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [refresh, t]);

  function clearIntent() {
    try {
      if (storageKey) sessionStorage.removeItem(storageKey);
    } catch {
      /* Retrying the same key remains safe. */
    }
    setPending(null);
    setMissing(false);
  }
  function accept(raw: FinanceObservation, intent: FinanceObservationInput) {
    const item = FinanceObservationSchema.parse(raw);
    if (!financeObservationMatchesInput(item, intent)) {
      throw new Error("Observation receipt does not match the saved operation");
    }
    clearIntent();
    setItems((prior) => [item, ...prior.filter((value) => value.id !== item.id)].slice(0, 100));
    setNote("");
    setDeadline("");
    setInvalidation("");
    setError(null);
  }
  async function send(input: FinanceObservationInput) {
    if (busy || !storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(input));
    } catch {
      setError(t`无法保存操作编号，观察记录未发送。`);
      return;
    }
    setPending(input);
    setMissing(false);
    setBusy(true);
    setError(null);
    try {
      accept(await rpc.finance.saveObservation(input), input);
    } catch (failure: unknown) {
      const code =
        failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (["BAD_REQUEST", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(code)) {
        clearIntent();
        setError(errorText(failure, t`观察记录未保存，请检查内容与研究状态。`));
      } else setError(t`尚未确认保存结果，请先查询原操作，再决定是否重试。`);
    } finally {
      setBusy(false);
    }
  }
  async function query() {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = listSchema.parse(await rpc.finance.observations({}));
      setItems(result);
      const found = result.find((item) => item.idempotencyKey === pending.idempotencyKey);
      if (found) accept(found, pending);
      else setMissing(true);
    } catch (failure: unknown) {
      setError(errorText(failure, t`暂时无法查询保存结果，请稍后再查。`));
    } finally {
      setBusy(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (busy || pending) return;
    const expires = deadline ? new Date(deadline) : null;
    if (expires && (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now())) {
      setError(t`有效期限应晚于当前时间。`);
      return;
    }
    const parsed = FinanceObservationInputSchema.safeParse({
      requestId,
      idempotencyKey: newClientId(),
      note,
      validUntil: expires?.toISOString() ?? null,
      invalidationCondition: invalidation.trim() || null,
    });
    if (!parsed.success || !completed.some((task) => task.id === requestId)) {
      setError(t`请选择已完成的研究并填写观察笔记。`);
      return;
    }
    void send(parsed.data);
  }
  return (
    <section className="space-y-4 border-t border-border pt-6" aria-label={t`观察记录`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">
            <Trans>观察记录</Trans>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            <Trans>保存原研究、自己的判断、期限和人工反证，方便后续复盘。</Trans>
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={busy || loading}
          onClick={() => {
            setError(null);
            setRefresh((value) => value + 1);
          }}
        >
          <Trans>刷新观察记录</Trans>
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {pending ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="break-all text-xs text-muted-foreground">
            <Trans>待确认保存</Trans> · {pending.idempotencyKey}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm">{pending.note}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void query()}>
              <Trans>查询观察记录结果</Trans>
            </Button>
            {missing ? (
              <Button variant="secondary" disabled={busy} onClick={() => void send(pending)}>
                <Trans>重试同一观察记录</Trans>
              </Button>
            ) : null}
          </div>
        </div>
      ) : completed.length ? (
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="observation-research">
              <Trans>原研究任务</Trans>
            </Label>
            <NativeSelect
              id="observation-research"
              value={requestId}
              disabled={busy || !storageKey}
              required
              onChange={(event) => setRequestId(event.target.value)}
            >
              <NativeSelectOption value="">
                <Trans>选择已完成的研究</Trans>
              </NativeSelectOption>
              {completed.map((task) => (
                <NativeSelectOption key={task.id} value={task.id}>
                  {String(task.request.symbol ?? task.request.strategy ?? task.id)} ·{" "}
                  {new Date(task.createdAt).toLocaleString()}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="observation-deadline">
              <Trans>有效期限（本地时间，可留空）</Trans>
            </Label>
            <Input
              id="observation-deadline"
              type="datetime-local"
              value={deadline}
              disabled={busy || !storageKey}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="observation-note">
              <Trans>观察笔记</Trans>
            </Label>
            <Textarea
              id="observation-note"
              rows={3}
              maxLength={2000}
              required
              value={note}
              disabled={busy || !storageKey}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-4 space-y-2">
              <Label htmlFor="observation-invalidation">
                <Trans>什么情况会推翻判断（可留空）</Trans>
              </Label>
              <Textarea
                id="observation-invalidation"
                rows={2}
                maxLength={1000}
                value={invalidation}
                disabled={busy || !storageKey}
                onChange={(event) => setInvalidation(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                <Trans>作为人工复查条件保存，不会自动判定研究失效。</Trans>
              </p>
            </div>
            <Button type="submit" disabled={busy || !storageKey || !requestId || !note.trim()}>
              <Trans>保存观察记录</Trans>
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Trans>完成真实研究后，可以从这里保存观察笔记。</Trans>
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          <Trans>正在读取观察记录…</Trans>
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        <Trans>最近 100 条观察记录 · 保存不会启动策略或交易</Trans>
      </p>
      {items.length ? (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <article key={item.id} className="space-y-2 py-4 text-sm">
              <p className="whitespace-pre-wrap break-words leading-relaxed">{item.note}</p>
              {item.invalidationCondition ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    <Trans>人工反证条件</Trans>
                  </p>
                  <p className="whitespace-pre-wrap break-words">{item.invalidationCondition}</p>
                </div>
              ) : null}
              <details>
                <summary className="cursor-pointer text-muted-foreground">
                  <Trans>原研究摘要</Trans>
                </summary>
                <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">
                  {item.summary || t`原研究未提供摘要。`}
                </p>
              </details>
              <p className="text-xs text-muted-foreground">
                <Trans>保存</Trans> · {new Date(item.createdAt).toLocaleString()} ·{" "}
                <Trans>有效期限</Trans> ·{" "}
                {item.validUntil ? new Date(item.validUntil).toLocaleString() : t`未设置`}
                {item.validUntil && Date.parse(item.validUntil) <= Date.now()
                  ? ` · ${t`已过期，保留供复盘`}`
                  : ""}
              </p>
              <p className="break-all text-xs text-muted-foreground">
                <Trans>原研究任务</Trans> · {item.requestId}
              </p>
            </article>
          ))}
        </div>
      ) : !loading ? (
        <p className="text-sm text-muted-foreground">
          <Trans>尚无观察记录。</Trans>
        </p>
      ) : null}
      <RuleDraftPanel userId={userId} observations={items} />
    </section>
  );
}
