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
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { glassHeaderOptions } from "../components/glass-title";
import { MenuPicker } from "../components/menu-picker";
import { NativeActionButton } from "../components/native-action-button";
import { NativeSegmentedControl } from "../components/native-segmented-control";
import { rpc } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { formatFinancialDateTime as dateTime } from "../lib/finance-time";
import { useI18n } from "../lib/i18n";
import { native, useMobileTokens, useThemedStyles } from "../lib/native";
import { errorText } from "../lib/user-error";

type Section = "news" | "briefs" | "subscriptions";

export default function IntelligenceScreen() {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const tokens = useMobileTokens();
  const [data, setData] = useState<IntelligenceList | null>(null);
  const [section, setSection] = useState<Section>("news");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedBrief, setSelectedBrief] = useState<IntelligenceBrief | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceKind, setSourceKind] = useState("market");
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
    void rpc("intelligence/list")
      .then((value) => {
        if (!cancelled) setData(IntelligenceListSchema.parse(value));
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(errorText(failure, t("无法读取新闻与订阅")));
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
        setData(IntelligenceListSchema.parse(await rpc("intelligence/list")));
      } catch (failure: unknown) {
        setError(errorText(failure, t("操作已保存，但刷新失败，请下拉刷新查看最新状态")));
      }
    } catch (failure: unknown) {
      setError(errorText(failure, t("操作未完成，请重试")));
    } finally {
      setBusy(false);
    }
  }
  const brief = selectedBrief ?? data?.briefs[0];

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
      <Stack.Screen options={glassHeaderOptions(t("新闻与日报"))} />
      <NativeSegmentedControl
        accessibilityLabel={t("新闻视图")}
        value={section}
        onChange={setSection}
        options={[
          { value: "news", label: t("推荐") },
          { value: "briefs", label: t("日报") },
          { value: "subscriptions", label: t("订阅") },
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {status ? <Text style={styles.secondary}>{status}</Text> : null}
      {data && error ? (
        <Text style={styles.caption}>{t("当前显示上次读取的新闻记录。")}</Text>
      ) : null}
      {loading && !data ? (
        <ActivityIndicator color={tokens.mutedForeground} accessibilityLabel={t("正在读取新闻")} />
      ) : null}
      {data && section === "news" ? (
        <>
          <RelatedSources grouping={data.grouping} />
          <Text style={styles.caption}>
            {t("最多展示最近 100 条匹配推荐，首次采集可能包含历史文章。新闻时间按设备时区显示。")}
          </Text>
          <NativeActionButton
            label={t("采集新闻")}
            prominence="secondary"
            disabled={busy || !data.sources.some((source) => source.enabled)}
            onPress={() =>
              void operate(() => rpc("intelligence/sync"), t("已安排采集，可下拉刷新查看结果"))
            }
          />
          {data.recommendations.length ? (
            data.recommendations.map((item) => (
              <Article
                key={item.id}
                item={item}
                busy={busy}
                onFeedback={(value) =>
                  void operate(() => rpc("intelligence/feedback", { id: item.id, value }))
                }
              />
            ))
          ) : (
            <Empty>{t("暂无匹配新闻。添加信息源和主题订阅后，采集结果会显示在这里。")}</Empty>
          )}
        </>
      ) : null}
      {data && section === "briefs" ? (
        <>
          <Text style={styles.caption}>{t("最近 7 份归档；各版保留归档时的内容。")}</Text>
          <NativeActionButton
            label={t("归档今日")}
            disabled={busy}
            onPress={() =>
              void operate(async () => {
                setSelectedBrief(
                  IntelligenceBriefSchema.parse(await rpc("intelligence/publishBrief")),
                );
              }, t("今日日报已归档"))
            }
          />
          {data.briefs.length ? (
            <MenuPicker
              label={t("日报日期")}
              value={brief?.id ?? ""}
              choices={data.briefs.map((item) => ({
                key: item.id,
                label: `${item.date} · v${item.version}`,
              }))}
              onChange={(value) =>
                setSelectedBrief(data.briefs.find((item) => item.id === value) ?? null)
              }
            />
          ) : null}
          {brief ? (
            <>
              <Text style={styles.heading}>
                {brief.date} · {t("日报")} · v{brief.version}
              </Text>
              <Text style={styles.caption}>
                {brief.timezone} · {dateTime(brief.publishedAt, brief.timezone)}
              </Text>
              <Text style={styles.caption}>
                {t("覆盖窗口（推荐产生时间）")}{" "}
                {dateTime(brief.coverage.windowStart, brief.timezone)} —{" "}
                {dateTime(brief.coverage.windowEnd, brief.timezone)}
              </Text>
              <Text style={styles.caption}>
                {t("匹配")} {brief.coverage.totalCount} · {t("归档")} {brief.items.length}/100
                {brief.coverage.truncated ? ` · ${t("已达上限，其余推荐未进入此版日报")}` : ""}
              </Text>
              {brief.correctionReason ? (
                <Text style={styles.secondary}>
                  {t("更正原因")}：{brief.correctionReason}
                </Text>
              ) : null}
              <View style={styles.form}>
                <Field
                  label={t("更正原因")}
                  value={correctionReason}
                  onChangeText={setCorrectionReason}
                  maxLength={500}
                  disabled={busy}
                />
                <Text style={styles.caption}>
                  {t(
                    "当天更正会更新至发布时刻，历史日报保留原窗口；每版最多 100 条，旧版保持不变。",
                  )}
                </Text>
                <NativeActionButton
                  label={t("发布更正版")}
                  prominence="secondary"
                  disabled={busy || !correctionReason.trim()}
                  onPress={() =>
                    void operate(async () => {
                      setSelectedBrief(
                        IntelligenceBriefSchema.parse(
                          await rpc("intelligence/correctBrief", {
                            briefId: brief.id,
                            expectedVersion: brief.version,
                            reason: correctionReason.trim(),
                          }),
                        ),
                      );
                      setCorrectionReason("");
                    }, t("已发布更正版，原版保留在归档中"))
                  }
                />
              </View>
              {brief.items.length ? (
                <>
                  <RelatedSources grouping={brief.grouping ?? undefined} />
                  {brief.items.map((item) => (
                    <Article key={item.id} item={item} />
                  ))}
                </>
              ) : (
                <Empty>{t("这份日报归档时没有匹配新闻。")}</Empty>
              )}
            </>
          ) : (
            <Empty>{t("还没有归档日报。归档会保留当时的推荐和内容版本。")}</Empty>
          )}
        </>
      ) : null}
      {data && section === "subscriptions" ? (
        <>
          <PreferencesEditor
            key={JSON.stringify(data.preferences)}
            preferences={data.preferences}
            busy={busy}
            onSave={(value) =>
              void operate(
                () => rpc("intelligence/updatePreferences", value),
                t("已保存日报与推送设置"),
              )
            }
          />
          <Group title={t("信息源")}>
            {data.sources.length ? (
              data.sources.map((source) => (
                <View key={source.id} style={styles.row}>
                  <View style={styles.between}>
                    <Text style={styles.label}>{source.name}</Text>
                    <Text style={styles.caption}>
                      {!source.enabled
                        ? t("已停用")
                        : source.status === "ok"
                          ? t("已采集")
                          : source.status === "failed"
                            ? t("采集失败")
                            : t("待采集")}
                    </Text>
                  </View>
                  <Text style={styles.caption}>
                    {source.kind === "author"
                      ? t("博主")
                      : source.kind === "macro"
                        ? t("宏观")
                        : t("市场")}
                  </Text>
                  <Text selectable style={styles.secondary}>
                    {source.url}
                  </Text>
                  {source.lastSuccessAt ? (
                    <Text style={styles.caption}>
                      {t("最近成功")} {dateTime(source.lastSuccessAt)}
                    </Text>
                  ) : null}
                  {source.lastError ? <Text style={styles.error}>{source.lastError}</Text> : null}
                  <NativeActionButton
                    label={source.enabled ? t("停用信息源") : t("启用信息源")}
                    prominence="plain"
                    disabled={busy}
                    onPress={() =>
                      void operate(() =>
                        rpc("intelligence/setSourceEnabled", {
                          id: source.id,
                          enabled: !source.enabled,
                        }),
                      )
                    }
                  />
                </View>
              ))
            ) : (
              <Empty>
                {t("添加可访问的 RSS 或 Atom 地址；博主订阅也需要可授权读取的信息源。")}
              </Empty>
            )}
          </Group>
          <View style={styles.form}>
            <Field
              label={t("信息源名称")}
              value={sourceName}
              onChangeText={setSourceName}
              maxLength={120}
              disabled={busy}
            />
            <View pointerEvents={busy ? "none" : "auto"}>
              <MenuPicker
                label={t("类型")}
                value={sourceKind}
                choices={[
                  { key: "market", label: t("市场") },
                  { key: "macro", label: t("宏观") },
                  { key: "author", label: t("博主") },
                ]}
                onChange={setSourceKind}
              />
            </View>
            <Field
              label={t("订阅地址（HTTPS）")}
              value={sourceUrl}
              onChangeText={setSourceUrl}
              maxLength={2048}
              disabled={busy}
              placeholder="https://example.com/feed.xml"
              url
            />
            <NativeActionButton
              label={t("添加信息源")}
              disabled={busy || !sourceName.trim() || !sourceUrl.trim()}
              onPress={() =>
                void operate(async () => {
                  await rpc("intelligence/createSource", {
                    name: sourceName.trim(),
                    url: sourceUrl.trim(),
                    kind: sourceKind,
                  });
                  setSourceName("");
                  setSourceUrl("");
                }, t("已添加信息源"))
              }
            />
          </View>
          <Group title={t("主题订阅")}>
            {data.subscriptions.length ? (
              data.subscriptions.map((subscription) => (
                <View key={subscription.id} style={styles.row}>
                  <Text style={styles.label}>{subscription.name}</Text>
                  <Text style={styles.caption}>
                    v{subscription.revision} · {subscription.enabled ? t("启用") : t("停用")}
                  </Text>
                  <Text style={styles.body}>{subscription.includeTerms.join("、")}</Text>
                  {subscription.excludeTerms.length ? (
                    <Text style={styles.secondary}>
                      {t("排除")} {subscription.excludeTerms.join("、")}
                    </Text>
                  ) : null}
                  <NativeActionButton
                    label={subscription.enabled ? t("停用订阅") : t("启用订阅")}
                    prominence="plain"
                    disabled={busy}
                    onPress={() =>
                      void operate(() =>
                        rpc("intelligence/setSubscriptionEnabled", {
                          id: subscription.id,
                          expectedRevision: subscription.revision,
                          enabled: !subscription.enabled,
                        }),
                      )
                    }
                  />
                </View>
              ))
            ) : (
              <Empty>{t("用主题词筛选内容，例如只接收某个博主提到比特币的文章。")}</Empty>
            )}
          </Group>
          <View style={styles.form}>
            <Field
              label={t("订阅名称")}
              value={subscriptionName}
              onChangeText={setSubscriptionName}
              maxLength={120}
              disabled={busy}
            />
            <View pointerEvents={busy ? "none" : "auto"}>
              <MenuPicker
                label={t("信息源范围")}
                value={sourceId}
                choices={[
                  { key: "", label: t("全部信息源") },
                  ...data.sources.map((source) => ({ key: source.id, label: source.name })),
                ]}
                onChange={setSourceId}
              />
            </View>
            <Field
              label={t("包含词（逗号分隔）")}
              value={includeTerms}
              onChangeText={setIncludeTerms}
              maxLength={3200}
              disabled={busy}
              placeholder="比特币, BTC, bitcoin"
            />
            <Field
              label={t("排除词（可选）")}
              value={excludeTerms}
              onChangeText={setExcludeTerms}
              maxLength={3200}
              disabled={busy}
            />
            <NativeActionButton
              label={t("预览真实样例")}
              prominence="secondary"
              disabled={busy || !terms(includeTerms).length}
              onPress={() => {
                setBusy(true);
                setError(null);
                void rpc("intelligence/previewSubscription", {
                  sourceId: sourceId || null,
                  includeTerms: terms(includeTerms),
                  excludeTerms: terms(excludeTerms),
                })
                  .then((value) => setSubscriptionPreview(IntelligencePreviewSchema.parse(value)))
                  .catch((failure: unknown) => setError(errorText(failure, t("无法预览当前订阅"))))
                  .finally(() => setBusy(false));
              }}
            />
            <NativeActionButton
              label={t("保存订阅")}
              disabled={busy || !subscriptionName.trim() || !terms(includeTerms).length}
              onPress={() =>
                void operate(async () => {
                  await rpc("intelligence/createSubscription", {
                    name: subscriptionName.trim(),
                    sourceId: sourceId || null,
                    includeTerms: terms(includeTerms),
                    excludeTerms: terms(excludeTerms),
                  });
                  setSubscriptionName("");
                  setIncludeTerms("");
                  setExcludeTerms("");
                }, t("已保存订阅"))
              }
            />
            {subscriptionPreview ? (
              <View style={styles.form}>
                <Text style={styles.label}>
                  {t("订阅预览")} · {subscriptionPreview.coverage.sampleCount}/100
                </Text>
                <Text style={styles.caption}>
                  {t("读取已采集缓存")} · {dateTime(subscriptionPreview.sampledAt)} ·{" "}
                  {subscriptionPreview.coverage.status === "available"
                    ? t("覆盖可用")
                    : subscriptionPreview.coverage.status === "partial"
                      ? t("覆盖不完整")
                      : t("尚未采集到可用样例")}
                  {subscriptionPreview.coverage.truncated ? ` · ${t("样例已截断")}` : ""}
                </Text>
                {subscriptionPreview.coverage.uncollectedSourceCount ? (
                  <Text style={styles.caption}>
                    {t("尚未采集的信息源")} {subscriptionPreview.coverage.uncollectedSourceCount}
                  </Text>
                ) : null}
                {subscriptionPreview.samples.map((sample) => (
                  <View key={`${sample.contentId}:${sample.contentRevision}`} style={styles.form}>
                    <Text style={styles.caption}>
                      {sample.status === "matched"
                        ? t("匹配")
                        : sample.status === "excluded"
                          ? t("排除")
                          : t("待复核")}{" "}
                      · {sample.sourceName}
                    </Text>
                    <NativeActionButton
                      label={sample.title}
                      prominence="secondary"
                      onPress={() => void Linking.openURL(sample.url)}
                    />
                    <Text style={styles.caption}>{sample.reason}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function RelatedSources({ grouping }: { grouping?: IntelligenceGrouping }) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);
  const groups = grouping?.groups.filter((group) => group.sourceIds.length > 1) ?? [];
  if (!groups.length) return null;
  return (
    <View style={styles.form}>
      <NativeActionButton
        label={`${t("跨来源候选关联")} · ${groups.length}`}
        prominence="secondary"
        onPress={() => setExpanded((value) => !value)}
      />
      {expanded ? (
        <>
          <Text style={styles.caption}>
            {t("按相同原文链接，或同一 UTC 日的相同标题关联；尚未核实为同一事件。")}
          </Text>
          {groups.map((group) => (
            <View key={group.id} style={styles.form}>
              <Text style={styles.body}>{group.title}</Text>
              <Text style={styles.caption}>
                {group.sourceNames.join(" · ")} ·{" "}
                {group.basis === "same_article_url" ? t("相同原文链接") : t("同日相同标题")}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
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
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [draft, setDraft] = useState(preferences);
  const [invalid, setInvalid] = useState(false);
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    key: String(hour),
    label: `${String(hour).padStart(2, "0")}:00`,
  }));
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t("日报与推送设置")}</Text>
      <Text style={styles.secondary}>
        {t(
          "日报日期采用所选时区，新闻范围以每版覆盖窗口为准。静默时段暂停设备推送，站内记录仍可查看；起止相同时表示无静默时段。",
        )}
      </Text>
      <View style={styles.form}>
        <Field
          label={t("时区（IANA）")}
          value={draft.timezone}
          onChangeText={(timezone) => setDraft({ ...draft, timezone })}
          maxLength={80}
          disabled={busy}
          placeholder="Asia/Shanghai"
        />
        <View pointerEvents={busy ? "none" : "auto"}>
          <MenuPicker
            label={t("设备推送")}
            value={String(draft.pushEnabled)}
            choices={[
              { key: "true", label: t("开启") },
              { key: "false", label: t("关闭") },
            ]}
            onChange={(value) => setDraft({ ...draft, pushEnabled: value === "true" })}
          />
          {(
            [
              ["digestHour", t("日报归档时间")],
              ["quietStart", t("静默开始")],
              ["quietEnd", t("静默结束")],
            ] as const
          ).map(([key, label]) => (
            <MenuPicker
              key={key}
              label={label}
              value={String(draft[key])}
              choices={hours}
              onChange={(value) => setDraft({ ...draft, [key]: Number(value) })}
            />
          ))}
        </View>
        {invalid ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t("请输入有效 IANA 时区，例如 Asia/Shanghai。")}
          </Text>
        ) : null}
        <NativeActionButton
          label={t("保存日报设置")}
          disabled={busy}
          onPress={() => {
            const parsed = IntelligencePreferencesSchema.safeParse(draft);
            setInvalid(!parsed.success);
            if (parsed.success) onSave(parsed.data);
          }}
        />
      </View>
    </View>
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
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [openError, setOpenError] = useState<string | null>(null);
  return (
    <View style={styles.article}>
      <Text style={styles.caption}>
        {item.sourceName}
        {item.author ? ` · ${item.author}` : ""} ·{" "}
        {item.publishedAt ? `${t("原文发布")} ${dateTime(item.publishedAt)}` : t("发布时间未知")}
      </Text>
      <Text style={styles.label}>{item.title}</Text>
      <Text selectable style={styles.body}>
        {item.excerpt}
      </Text>
      <Text style={styles.secondary}>
        {t("推荐原因")}：{item.reason}
        {item.matchedTerms.length ? ` · ${item.matchedTerms.join("、")}` : ""}
      </Text>
      <Text style={styles.caption}>
        {t("首次发现")} {dateTime(item.firstSeenAt)} · {t("内容版本")} {item.contentRevision}
      </Text>
      <NativeActionButton
        label={t("打开原文")}
        prominence="plain"
        onPress={() => {
          setOpenError(null);
          void Linking.openURL(item.url).catch((failure: unknown) =>
            setOpenError(errorText(failure, t("无法打开原文"))),
          );
        }}
      />
      {openError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {openError}
        </Text>
      ) : null}
      {onFeedback ? (
        <View style={styles.actions}>
          <NativeActionButton
            label={item.feedback === "read" ? t("已读 ✓") : t("已读")}
            prominence="plain"
            disabled={busy}
            onPress={() => onFeedback("read")}
          />
          <NativeActionButton
            label={item.feedback === "useful" ? t("有用 ✓") : t("有用")}
            prominence="plain"
            disabled={busy}
            onPress={() => onFeedback("useful")}
          />
          <NativeActionButton
            label={item.feedback === "irrelevant" ? t("不相关 ✓") : t("不相关")}
            prominence="plain"
            disabled={busy}
            onPress={() => onFeedback("irrelevant")}
          />
        </View>
      ) : null}
    </View>
  );
}
function Field({
  label,
  value,
  onChangeText,
  maxLength,
  disabled,
  placeholder,
  url,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  maxLength: number;
  disabled: boolean;
  placeholder?: string;
  url?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.caption}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={native.secondaryLabel}
        autoCapitalize={url ? "none" : "sentences"}
        autoCorrect={!url}
        keyboardType={url ? "url" : "default"}
        style={styles.input}
      />
    </View>
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
function Empty({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return <Text style={styles.empty}>{children}</Text>;
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
    between: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
    label: { color: tokens.foreground, fontSize: 17, fontWeight: "600", lineHeight: 25 },
    body: { color: tokens.foreground, fontSize: 17, lineHeight: 26 },
    secondary: { color: tokens.mutedForeground, fontSize: 15, lineHeight: 23 },
    caption: { color: tokens.mutedForeground, fontSize: 13, lineHeight: 20 },
    empty: {
      backgroundColor: native.groupedCell,
      borderRadius: 12,
      padding: 16,
      color: tokens.mutedForeground,
      fontSize: 15,
      lineHeight: 23,
    },
    error: { color: tokens.destructive, fontSize: 15, lineHeight: 23 },
    form: { gap: 12 },
    field: { gap: 8 },
    input: {
      minHeight: 48,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tokens.border,
      color: tokens.foreground,
      backgroundColor: native.groupedCell,
      paddingHorizontal: 14,
      fontSize: 17,
    },
    article: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.border,
      paddingBottom: 24,
      gap: 12,
    },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  });
}
