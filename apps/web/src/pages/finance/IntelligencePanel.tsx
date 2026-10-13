import { Trans, useLingui } from "@lingui/react/macro";
import type {
  IntelligenceBrief,
  IntelligenceGrouping,
  IntelligenceList,
  IntelligencePreferences,
  IntelligencePreview,
  IntelligenceRecommendation,
} from "@marketbot/contracts";
import {
  IntelligenceBriefSchema,
  IntelligenceListSchema,
  IntelligencePreferencesSchema,
  IntelligencePreviewSchema,
} from "@marketbot/contracts";
import {
  Badge,
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
} from "@marketbot/ui-web";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { formatFinancialDateTime as dateTime } from "../../lib/finance-time";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

type View = "news" | "briefs" | "subscriptions";

export function IntelligencePanel() {
  const { t } = useLingui();
  const [data, setData] = useState<IntelligenceList | null>(null);
  const [view, setView] = useState<View>("news");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedBrief, setSelectedBrief] = useState<IntelligenceBrief | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceKind, setSourceKind] = useState<"market" | "macro" | "author">("market");
  const [subscriptionName, setSubscriptionName] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [includeTerms, setIncludeTerms] = useState("");
  const [excludeTerms, setExcludeTerms] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [subscriptionPreview, setSubscriptionPreview] = useState<IntelligencePreview | null>(null);

  useEffect(() => {
    setSubscriptionPreview(null);
  }, [sourceId, includeTerms, excludeTerms]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void rpc.intelligence
      .list({})
      .then((value) => {
        if (!cancelled) setData(IntelligenceListSchema.parse(value));
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(errorText(failure, t`无法读取新闻与订阅`));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry, t]);

  async function operate(action: () => Promise<unknown>, message?: string) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await action();
      if (message) setStatus(message);
      try {
        setData(IntelligenceListSchema.parse(await rpc.intelligence.list({})));
      } catch (failure: unknown) {
        setError(errorText(failure, t`操作已保存，但刷新失败，请刷新查看最新状态`));
      }
    } catch (failure: unknown) {
      setError(errorText(failure, t`操作未完成，请重试`));
    } finally {
      setBusy(false);
    }
  }
  function createSource(event: FormEvent) {
    event.preventDefault();
    void operate(async () => {
      await rpc.intelligence.createSource({
        name: sourceName.trim(),
        url: sourceUrl.trim(),
        kind: sourceKind,
      });
      setSourceName("");
      setSourceUrl("");
    }, t`已添加信息源`);
  }
  function createSubscription(event: FormEvent) {
    event.preventDefault();
    void operate(async () => {
      await rpc.intelligence.createSubscription({
        name: subscriptionName.trim(),
        sourceId: sourceId || null,
        includeTerms: terms(includeTerms),
        excludeTerms: terms(excludeTerms),
      });
      setSubscriptionName("");
      setIncludeTerms("");
      setExcludeTerms("");
    }, t`已保存订阅`);
  }
  const brief = selectedBrief ?? data?.briefs[0];

  async function previewSubscription() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setSubscriptionPreview(
        IntelligencePreviewSchema.parse(
          await rpc.intelligence.previewSubscription({
            sourceId: sourceId || null,
            includeTerms: terms(includeTerms),
            excludeTerms: terms(excludeTerms),
          }),
        ),
      );
    } catch (failure: unknown) {
      setError(errorText(failure, t`无法预览当前订阅`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold">
          <Trans>新闻与日报</Trans>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={loading || busy}
            onClick={() => setRetry((value) => value + 1)}
            aria-label={t`刷新新闻与订阅`}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <Trans>刷新</Trans>
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !data?.sources.some((source) => source.enabled)}
            onClick={() =>
              void operate(() => rpc.intelligence.sync({}), t`已安排采集，可刷新查看结果`)
            }
          >
            <Trans>采集新闻</Trans>
          </Button>
          <Button
            disabled={busy || !data}
            onClick={() =>
              void operate(async () => {
                setSelectedBrief(
                  IntelligenceBriefSchema.parse(await rpc.intelligence.publishBrief({})),
                );
                setView("briefs");
              }, t`今日日报已归档`)
            }
          >
            <Trans>归档今日</Trans>
          </Button>
        </div>
      </div>
      <nav className="mb-6 flex flex-wrap gap-1" aria-label={t`新闻视图`}>
        <Button
          variant={view === "news" ? "secondary" : "ghost"}
          aria-pressed={view === "news"}
          onClick={() => setView("news")}
        >
          <Trans>推荐</Trans>
        </Button>
        <Button
          variant={view === "briefs" ? "secondary" : "ghost"}
          aria-pressed={view === "briefs"}
          onClick={() => setView("briefs")}
        >
          <Trans>日报归档</Trans>
        </Button>
        <Button
          variant={view === "subscriptions" ? "secondary" : "ghost"}
          aria-pressed={view === "subscriptions"}
          onClick={() => setView("subscriptions")}
        >
          <Trans>信息源与订阅</Trans>
        </Button>
      </nav>
      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-muted p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {status}
        </p>
      ) : null}
      {loading && !data ? <Skeleton className="h-40 w-full" /> : null}
      {data && error ? (
        <p role="status" className="mb-4 text-xs text-muted-foreground">
          <Trans>当前显示上次读取的新闻记录。</Trans>
        </p>
      ) : null}
      {data && view === "news" && data.recommendations.length ? (
        <p className="mb-4 text-xs text-muted-foreground">
          <Trans>
            最多展示最近 100 条匹配推荐，首次采集可能包含历史文章。新闻时间按设备时区显示。
          </Trans>
        </p>
      ) : null}
      {data && view === "news" ? (
        data.recommendations.length ? (
          <div>
            <RelatedSources grouping={data.grouping} />
            <div className="divide-y divide-border border-y border-border">
              {data.recommendations.map((item) => (
                <Article
                  key={item.id}
                  item={item}
                  busy={busy}
                  onFeedback={(value) =>
                    void operate(() => rpc.intelligence.feedback({ id: item.id, value }))
                  }
                />
              ))}
            </div>
          </div>
        ) : (
          <Empty>
            <Trans>暂无匹配新闻。添加信息源和主题订阅后，采集结果会显示在这里。</Trans>
          </Empty>
        )
      ) : null}
      {data && view === "briefs" ? (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            <Trans>最近 7 份归档；各版保留归档时的内容。</Trans>
          </p>
          <div className="flex flex-wrap gap-2">
            {data.briefs.map((brief) => (
              <Button
                key={brief.id}
                variant={
                  (selectedBrief?.id ?? data.briefs[0]?.id) === brief.id ? "secondary" : "ghost"
                }
                onClick={() => {
                  setSelectedBrief(brief);
                  setCorrectionReason("");
                }}
              >
                {brief.date} · v{brief.version}
              </Button>
            ))}
          </div>
          {brief ? (
            <>
              <RelatedSources grouping={brief.grouping ?? undefined} />
              <details className="max-w-prose rounded-lg border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  <Trans>更正这份日报</Trans>
                </summary>
                <form
                  className="space-y-3 pt-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void operate(async () => {
                      setSelectedBrief(
                        IntelligenceBriefSchema.parse(
                          await rpc.intelligence.correctBrief({
                            briefId: brief.id,
                            expectedVersion: brief.version,
                            reason: correctionReason.trim(),
                          }),
                        ),
                      );
                      setCorrectionReason("");
                    }, t`已发布更正版，原版保留在归档中`);
                  }}
                >
                  <Label htmlFor="brief-correction">
                    <Trans>更正原因</Trans>
                  </Label>
                  <Input
                    id="brief-correction"
                    maxLength={500}
                    value={correctionReason}
                    onChange={(event) => setCorrectionReason(event.target.value)}
                    disabled={busy}
                    required
                  />
                  <p className="text-xs leading-6 text-muted-foreground">
                    <Trans>
                      当天更正会更新至发布时刻，历史日报保留原窗口；每版最多 100 条，旧版保持不变。
                    </Trans>
                  </p>
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={busy || !correctionReason.trim()}
                  >
                    <Trans>发布更正版</Trans>
                  </Button>
                </form>
              </details>
              <Brief brief={brief} />
            </>
          ) : (
            <Empty>
              <Trans>还没有归档日报。归档会保留当时的推荐和内容版本。</Trans>
            </Empty>
          )}
        </div>
      ) : null}
      {data && view === "subscriptions" ? (
        <div className="space-y-10">
          <PreferencesEditor
            key={JSON.stringify(data.preferences)}
            preferences={data.preferences}
            busy={busy}
            onSave={(value) =>
              void operate(() => rpc.intelligence.updatePreferences(value), t`已保存日报与推送设置`)
            }
          />
          <section>
            <h3 className="mb-4 font-medium">
              <Trans>信息源</Trans>
            </h3>
            {data.sources.length ? (
              <ul className="mb-5 divide-y divide-border border-y border-border">
                {data.sources.map((source) => (
                  <li key={source.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">
                        {source.name}
                        <span className="ms-2 text-xs font-normal text-muted-foreground">
                          {source.kind === "author"
                            ? t`博主`
                            : source.kind === "macro"
                              ? t`宏观`
                              : t`市场`}
                        </span>
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {!source.enabled
                            ? t`已停用`
                            : source.status === "ok"
                              ? t`已采集`
                              : source.status === "failed"
                                ? t`采集失败`
                                : t`待采集`}
                        </Badge>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            void operate(
                              () =>
                                rpc.intelligence.setSourceEnabled({
                                  id: source.id,
                                  enabled: !source.enabled,
                                }),
                              source.enabled ? t`已停用信息源` : t`已启用信息源`,
                            )
                          }
                        >
                          {source.enabled ? t`停用` : t`启用`}
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">{source.url}</p>
                    {source.lastSuccessAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Trans>最近成功</Trans> {dateTime(source.lastSuccessAt)}
                      </p>
                    ) : null}
                    {source.lastError ? (
                      <p className="mt-2 text-xs text-destructive">{source.lastError}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                <Trans>添加可访问的 RSS 或 Atom 地址；博主订阅也需要可授权读取的信息源。</Trans>
              </Empty>
            )}
            <form onSubmit={createSource} className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source-name">
                  <Trans>信息源名称</Trans>
                </Label>
                <Input
                  id="source-name"
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                  maxLength={120}
                  required
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-kind">
                  <Trans>类型</Trans>
                </Label>
                <NativeSelect
                  id="source-kind"
                  value={sourceKind}
                  onChange={(event) => setSourceKind(event.target.value as typeof sourceKind)}
                  disabled={busy}
                >
                  <NativeSelectOption value="market">
                    <Trans>市场</Trans>
                  </NativeSelectOption>
                  <NativeSelectOption value="macro">
                    <Trans>宏观</Trans>
                  </NativeSelectOption>
                  <NativeSelectOption value="author">
                    <Trans>博主</Trans>
                  </NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="source-url">
                  <Trans>订阅地址（HTTPS）</Trans>
                </Label>
                <Input
                  id="source-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  maxLength={2048}
                  placeholder="https://example.com/feed.xml"
                  required
                  disabled={busy}
                />
              </div>
              <Button
                type="submit"
                className="w-fit"
                disabled={busy || !sourceName.trim() || !sourceUrl.trim()}
              >
                <Trans>添加信息源</Trans>
              </Button>
            </form>
          </section>
          <section>
            <h3 className="mb-4 font-medium">
              <Trans>主题订阅</Trans>
            </h3>
            {data.subscriptions.length ? (
              <ul className="mb-5 divide-y divide-border border-y border-border">
                {data.subscriptions.map((subscription) => (
                  <li key={subscription.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">
                        {subscription.name}
                        <span className="ms-2 text-xs font-normal text-muted-foreground">
                          v{subscription.revision} · {subscription.enabled ? t`启用` : t`停用`}
                        </span>
                      </p>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void operate(
                            () =>
                              rpc.intelligence.setSubscriptionEnabled({
                                id: subscription.id,
                                expectedRevision: subscription.revision,
                                enabled: !subscription.enabled,
                              }),
                            subscription.enabled ? t`已停用订阅` : t`已启用订阅`,
                          )
                        }
                      >
                        {subscription.enabled ? t`停用` : t`启用`}
                      </Button>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {subscription.includeTerms.join("、")}
                      {subscription.excludeTerms.length
                        ? ` · ${t`排除`} ${subscription.excludeTerms.join("、")}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                <Trans>用主题词筛选内容，例如只接收某个博主提到比特币的文章。</Trans>
              </Empty>
            )}
            <form onSubmit={createSubscription} className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subscription-name">
                  <Trans>订阅名称</Trans>
                </Label>
                <Input
                  id="subscription-name"
                  value={subscriptionName}
                  onChange={(event) => setSubscriptionName(event.target.value)}
                  maxLength={120}
                  required
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscription-source">
                  <Trans>信息源范围</Trans>
                </Label>
                <NativeSelect
                  id="subscription-source"
                  value={sourceId}
                  onChange={(event) => setSourceId(event.target.value)}
                  disabled={busy}
                >
                  <NativeSelectOption value="">
                    <Trans>全部信息源</Trans>
                  </NativeSelectOption>
                  {data.sources.map((source) => (
                    <NativeSelectOption key={source.id} value={source.id}>
                      {source.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="include-terms">
                  <Trans>包含词（逗号分隔）</Trans>
                </Label>
                <Input
                  id="include-terms"
                  value={includeTerms}
                  onChange={(event) => setIncludeTerms(event.target.value)}
                  maxLength={3200}
                  placeholder="比特币, BTC, bitcoin"
                  required
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exclude-terms">
                  <Trans>排除词（可选）</Trans>
                </Label>
                <Input
                  id="exclude-terms"
                  value={excludeTerms}
                  onChange={(event) => setExcludeTerms(event.target.value)}
                  maxLength={3200}
                  disabled={busy}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-fit"
                disabled={busy || !terms(includeTerms).length}
                onClick={() => void previewSubscription()}
              >
                <Trans>预览真实样例</Trans>
              </Button>
              <Button
                type="submit"
                className="w-fit"
                disabled={busy || !subscriptionName.trim() || !terms(includeTerms).length}
              >
                <Trans>保存订阅</Trans>
              </Button>
            </form>
            {subscriptionPreview ? (
              <details open className="mt-5 rounded-lg border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  <Trans>订阅预览</Trans> · {subscriptionPreview.coverage.sampleCount}/100
                </summary>
                <p className="mt-3 text-xs text-muted-foreground">
                  <Trans>读取已采集缓存</Trans> · {dateTime(subscriptionPreview.sampledAt)} ·{" "}
                  {subscriptionPreview.coverage.status === "available"
                    ? t`覆盖可用`
                    : subscriptionPreview.coverage.status === "partial"
                      ? t`覆盖不完整`
                      : t`尚未采集到可用样例`}
                  {subscriptionPreview.coverage.truncated ? ` · ${t`样例已截断`}` : ""}
                </p>
                {subscriptionPreview.coverage.uncollectedSourceCount ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <Trans>尚未采集的信息源</Trans>{" "}
                    {subscriptionPreview.coverage.uncollectedSourceCount}
                  </p>
                ) : null}
                <ul className="mt-3 max-h-96 divide-y overflow-y-auto">
                  {subscriptionPreview.samples.map((sample) => (
                    <li key={`${sample.contentId}:${sample.contentRevision}`} className="py-3">
                      <p className="text-xs text-muted-foreground">
                        {sample.status === "matched"
                          ? t`匹配`
                          : sample.status === "excluded"
                            ? t`排除`
                            : t`待复核`}{" "}
                        · {sample.sourceName}
                      </p>
                      <a
                        href={sample.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-sm underline-offset-4 hover:underline"
                      >
                        {sample.title}
                      </a>
                      <p className="mt-1 text-xs text-muted-foreground">{sample.reason}</p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function RelatedSources({ grouping }: { grouping?: IntelligenceGrouping }) {
  const { t } = useLingui();
  const groups = grouping?.groups.filter((group) => group.sourceIds.length > 1) ?? [];
  if (!groups.length) return null;
  return (
    <details className="mb-5 rounded-lg border border-border p-4">
      <summary className="cursor-pointer text-sm font-medium">
        <Trans>跨来源候选关联</Trans> · {groups.length}
      </summary>
      <p className="mt-3 text-xs text-muted-foreground">
        <Trans>按相同原文链接，或同一 UTC 日的相同标题关联；尚未核实为同一事件。</Trans>
      </p>
      <ul className="mt-3 divide-y">
        {groups.map((group) => (
          <li key={group.id} className="py-3">
            <p className="text-sm">{group.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {group.sourceNames.join(" · ")} ·{" "}
              {group.basis === "same_article_url" ? t`相同原文链接` : t`同日相同标题`}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {group.recommendationIds.map((id, index) => (
                <a
                  key={id}
                  href={`#recommendation-${id}`}
                  className="text-xs underline underline-offset-4"
                >
                  <Trans>查看来源</Trans> {index + 1}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function PreferencesEditor({
  preferences,
  busy,
  onSave,
}: {
  preferences: IntelligencePreferences;
  busy: boolean;
  onSave: (value: IntelligencePreferences) => void;
}) {
  const { t } = useLingui();
  const [draft, setDraft] = useState(preferences);
  const [validationError, setValidationError] = useState(false);
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  return (
    <section>
      <h3 className="mb-4 font-medium">
        <Trans>日报与推送设置</Trans>
      </h3>
      <p className="mb-5 max-w-prose text-sm leading-6 text-muted-foreground">
        <Trans>
          日报日期采用所选时区，新闻范围以每版覆盖窗口为准。静默时段暂停设备推送，站内记录仍可查看；起止相同时表示无静默时段。
        </Trans>
      </p>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = IntelligencePreferencesSchema.safeParse(draft);
          setValidationError(!parsed.success);
          if (parsed.success) onSave(parsed.data);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="digest-timezone">
            <Trans>时区（IANA）</Trans>
          </Label>
          <Input
            id="digest-timezone"
            value={draft.timezone}
            maxLength={80}
            disabled={busy}
            required
            onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}
            placeholder="Asia/Shanghai"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="digest-push">
            <Trans>设备推送</Trans>
          </Label>
          <NativeSelect
            id="digest-push"
            value={String(draft.pushEnabled)}
            disabled={busy}
            onChange={(event) => setDraft({ ...draft, pushEnabled: event.target.value === "true" })}
          >
            <NativeSelectOption value="true">
              <Trans>开启</Trans>
            </NativeSelectOption>
            <NativeSelectOption value="false">
              <Trans>关闭</Trans>
            </NativeSelectOption>
          </NativeSelect>
        </div>
        {(
          [
            ["digestHour", t`日报归档时间`],
            ["quietStart", t`静默开始`],
            ["quietEnd", t`静默结束`],
          ] as const
        ).map(([key, label]) => (
          <div className="space-y-2" key={key}>
            <Label htmlFor={`digest-${key}`}>{label}</Label>
            <NativeSelect
              id={`digest-${key}`}
              value={String(draft[key])}
              disabled={busy}
              onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })}
            >
              {hours.map((hour) => (
                <NativeSelectOption
                  key={hour}
                  value={String(hour)}
                >{`${String(hour).padStart(2, "0")}:00`}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))}
        {validationError ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            <Trans>请输入有效 IANA 时区，例如 Asia/Shanghai。</Trans>
          </p>
        ) : null}
        <Button type="submit" className="w-fit sm:col-span-2" disabled={busy}>
          <Trans>保存日报设置</Trans>
        </Button>
      </form>
    </section>
  );
}

function Article({
  item,
  busy,
  onFeedback,
}: {
  item: IntelligenceRecommendation;
  busy?: boolean;
  onFeedback?: (value: "read" | "useful" | "irrelevant") => void;
}) {
  return (
    <article id={`recommendation-${item.id}`} className="py-5 scroll-mt-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {item.sourceName}
          {item.author ? ` · ${item.author}` : ""}
        </span>
        <span>
          {item.publishedAt ? (
            <>
              <Trans>原文发布</Trans> {dateTime(item.publishedAt)}
            </>
          ) : (
            <Trans>发布时间未知</Trans>
          )}
        </span>
        <span>
          <Trans>首次发现</Trans> {dateTime(item.firstSeenAt)}
        </span>
      </div>
      <h3 className="max-w-prose text-base font-medium leading-7">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {item.title}
          <ExternalLink
            size={13}
            aria-hidden="true"
            className="ms-2 inline text-muted-foreground"
          />
        </a>
      </h3>
      <p className="mt-3 max-w-prose whitespace-pre-wrap text-sm leading-7">{item.excerpt}</p>
      <p className="mt-3 max-w-prose text-xs leading-6 text-muted-foreground">
        <Trans>推荐原因</Trans>：{item.reason}
        {item.matchedTerms.length ? ` · ${item.matchedTerms.join("、")}` : ""} ·{" "}
        <Trans>内容版本</Trans> {item.contentRevision}
      </p>
      {onFeedback ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant={item.feedback === "read" ? "secondary" : "ghost"}
            aria-pressed={item.feedback === "read"}
            disabled={busy}
            onClick={() => onFeedback("read")}
          >
            <Trans>已读</Trans>
          </Button>
          <Button
            variant={item.feedback === "useful" ? "secondary" : "ghost"}
            aria-pressed={item.feedback === "useful"}
            disabled={busy}
            onClick={() => onFeedback("useful")}
          >
            <Trans>有用</Trans>
          </Button>
          <Button
            variant={item.feedback === "irrelevant" ? "secondary" : "ghost"}
            aria-pressed={item.feedback === "irrelevant"}
            disabled={busy}
            onClick={() => onFeedback("irrelevant")}
          >
            <Trans>不相关</Trans>
          </Button>
        </div>
      ) : null}
    </article>
  );
}
function Brief({ brief }: { brief: IntelligenceBrief }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">
          {brief.date} · <Trans>日报</Trans> · v{brief.version}
        </h3>
        <p className="text-xs text-muted-foreground">
          {brief.timezone} · {dateTime(brief.publishedAt, brief.timezone)}
        </p>
      </div>
      <p className="mb-4 text-xs leading-6 text-muted-foreground">
        <Trans>覆盖窗口（推荐产生时间）</Trans>{" "}
        {dateTime(brief.coverage.windowStart, brief.timezone)} —{" "}
        {dateTime(brief.coverage.windowEnd, brief.timezone)} · <Trans>匹配</Trans>{" "}
        {brief.coverage.totalCount} · <Trans>归档</Trans> {brief.items.length}/100
        {brief.coverage.truncated ? (
          <>
            <span> · </span>
            <Trans>已达上限，其余推荐未进入此版日报</Trans>
          </>
        ) : null}
      </p>
      {brief.correctionReason ? (
        <p className="mb-4 text-sm text-muted-foreground">
          <Trans>更正原因</Trans>：{brief.correctionReason}
        </p>
      ) : null}
      {brief.items.length ? (
        <div className="divide-y divide-border border-y border-border">
          {brief.items.map((item) => (
            <Article key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Empty>
          <Trans>这份日报归档时没有匹配新闻。</Trans>
        </Empty>
      )}
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-prose rounded-xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
      {children}
    </p>
  );
}
function terms(value: string) {
  return [
    ...new Set(
      value
        .split(/[,，\n]/)
        .map((term) => term.trim())
        .filter(Boolean),
    ),
  ];
}
