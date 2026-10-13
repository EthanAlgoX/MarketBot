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
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { useMobileTokens, useThemedStyles } from "../lib/native";
import { useFinanceIntent, useFinanceSession } from "../lib/use-finance-session";
import { errorText } from "../lib/user-error";
import { NativeActionButton } from "./native-action-button";
import { ResearchRuleDrafts } from "./research-rule-drafts";

const listSchema = FinanceObservationSchema.array().max(100);

export function ResearchObservations({ request }: { request: FinanceResearchRequest | null }) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const tokens = useMobileTokens();
  const [items, setItems] = useState<FinanceObservation[]>([]);
  const [pending, setPending] = useState<FinanceObservationInput | null>(null);
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState("");
  const [deadline, setDeadline] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const session = useFinanceSession(setError);
  const storageKey = useFinanceIntent(
    session,
    "observation",
    FinanceObservationInputSchema,
    setPending,
    setError,
    t("无法恢复观察记录操作"),
  );

  useEffect(() => {
    if (!session?.isCurrent()) return;
    let cancelled = false;
    setLoading(true);
    void session!
      .request("finance/observations", {})
      .then((value) => {
        if (!cancelled && session!.isCurrent()) setItems(listSchema.parse(value));
      })
      .catch((failure: unknown) => {
        if (!cancelled && session!.isCurrent()) setError(errorText(failure, t("无法读取观察记录")));
      })
      .finally(() => {
        if (!cancelled && session!.isCurrent()) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry, t]);

  async function clearIntent() {
    if (!session?.isCurrent() || !storageKey) throw new Error("Financial session changed");
    await session.clear(storageKey);
  }
  async function applied(item: FinanceObservation, input: FinanceObservationInput) {
    if (!financeObservationMatchesInput(item, input))
      throw new Error("Observation receipt mismatch");
    await clearIntent();
    if (!session?.isCurrent()) return;
    setPending(null);
    setMissing(false);
    setNote("");
    setDeadline("");
    setInvalidation("");
    setItems((values) => [item, ...values.filter((value) => value.id !== item.id)].slice(0, 100));
  }
  async function send(input: FinanceObservationInput) {
    if (!storageKey || busy || !session?.isCurrent()) return;
    setBusy(true);
    setError(null);
    setMissing(false);
    try {
      await session!.persist(storageKey, JSON.stringify(input));
    } catch {
      if (!session?.isCurrent()) return;
      setError(t("无法保存操作编号，本次记录未发送。"));
      setBusy(false);
      return;
    }
    setPending(input);
    try {
      await applied(
        FinanceObservationSchema.parse(await session!.request("finance/saveObservation", input)),
        input,
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
        setError(errorText(failure, t("观察记录未保存，请刷新后重试")));
      } else setError(t("尚未确认保存结果，请先查询；重试会保留原操作编号。"));
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }
  async function check() {
    if (!pending || busy || !session?.isCurrent()) return;
    setBusy(true);
    setError(null);
    try {
      const values = listSchema.parse(await session!.request("finance/observations", {}));
      setItems(values);
      const found = values.find((value) => value.idempotencyKey === pending.idempotencyKey);
      if (found) await applied(found, pending);
      else setMissing(true);
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      setError(errorText(failure, t("暂时无法查询观察记录，请稍后再查")));
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }
  function create() {
    if (request?.status !== "succeeded" || pending || busy || !storageKey) return;
    const input = FinanceObservationInputSchema.safeParse({
      requestId: request.id,
      idempotencyKey: `observation:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`,
      note,
      validUntil: deadline.trim() || null,
      invalidationCondition: invalidation.trim() || null,
    });
    if (!input.success) {
      setError(t("请填写观察笔记；有效期限留空或使用完整 UTC 时间，例如 2026-10-20T08:00:00Z。"));
      return;
    }
    void send(input.data);
  }

  if (!session) return <Text accessibilityRole="alert">{error ?? t("正在确认金融会话…")}</Text>;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t("观察记录")}</Text>
      <Text style={styles.secondary}>
        {t("保存已完成研究的原摘要、自己的笔记与有效期限，方便后续复盘。保存不会启动策略或交易。")}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {pending ? (
        <View style={styles.group}>
          <Text selectable style={styles.caption}>
            {t("待确认保存")} · {pending.idempotencyKey}
          </Text>
          <Text style={styles.body}>{pending.note}</Text>
          <NativeActionButton
            label={t("查询观察记录结果")}
            disabled={busy}
            prominence="secondary"
            onPress={() => void check()}
          />
          {missing ? (
            <NativeActionButton
              label={t("重试同一观察记录")}
              disabled={busy}
              prominence="secondary"
              onPress={() => void send(pending)}
            />
          ) : null}
        </View>
      ) : request?.status === "succeeded" && request.result && request.resultRef ? (
        <View style={styles.group}>
          <Text style={styles.label}>{t("保存当前研究为观察记录")}</Text>
          <Text style={styles.caption}>{t("观察笔记")}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={note}
            onChangeText={setNote}
            maxLength={2000}
            multiline
            editable={!busy && !!storageKey}
            accessibilityLabel={t("观察笔记")}
            placeholder={t("记录观点、需要验证的条件或复盘要点")}
            placeholderTextColor={tokens.mutedForeground}
          />
          <Text style={styles.caption}>{t("有效期限（可留空，UTC 时间）")}</Text>
          <TextInput
            style={styles.input}
            value={deadline}
            onChangeText={setDeadline}
            maxLength={40}
            editable={!busy && !!storageKey}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t("观察记录有效期限")}
            placeholder="2026-10-20T08:00:00Z"
            placeholderTextColor={tokens.mutedForeground}
          />
          <Text style={styles.caption}>{t("什么情况会推翻判断（可留空）")}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={invalidation}
            onChangeText={setInvalidation}
            maxLength={1000}
            multiline
            editable={!busy && !!storageKey}
            accessibilityLabel={t("研究人工反证条件")}
            placeholderTextColor={tokens.mutedForeground}
          />
          <Text style={styles.caption}>{t("作为人工复查条件保存，不会自动判定研究失效。")}</Text>
          <NativeActionButton
            label={t("保存观察记录")}
            disabled={busy || !storageKey || !note.trim()}
            onPress={create}
          />
        </View>
      ) : (
        <Text style={styles.caption}>{t("打开已完成的真实研究任务后，可以保存观察笔记。")}</Text>
      )}
      <NativeActionButton
        label={t("刷新观察记录")}
        disabled={busy || loading}
        prominence="secondary"
        onPress={() => {
          setError(null);
          setRetry((value) => value + 1);
        }}
      />
      {loading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
      <Text style={styles.caption}>{t("最近 100 条观察记录")}</Text>
      {items.length ? (
        items.map((item) => (
          <View style={styles.group} key={item.id}>
            <Text style={styles.label}>{t("观察笔记")}</Text>
            <Text selectable style={styles.body}>
              {item.note}
            </Text>
            {item.invalidationCondition ? (
              <>
                <Text style={styles.caption}>{t("人工反证条件")}</Text>
                <Text selectable style={styles.body}>
                  {item.invalidationCondition}
                </Text>
              </>
            ) : null}
            <Text style={styles.caption}>{t("原研究摘要")}</Text>
            <Text selectable style={styles.body}>
              {item.summary || t("原研究未提供摘要。")}
            </Text>
            <Text style={styles.caption}>
              {t("保存时间")} · {time(item.createdAt)}
            </Text>
            <Text style={styles.caption}>
              {t("有效期限")} · {item.validUntil ? time(item.validUntil) : t("未设置")}
            </Text>
            {item.validUntil && Date.parse(item.validUntil) < Date.now() ? (
              <Text style={styles.caption}>{t("已过期，保留原记录供复盘。")}</Text>
            ) : null}
            <Text selectable style={styles.caption}>
              {t("原研究任务")} · {item.requestId}
            </Text>
          </View>
        ))
      ) : !loading ? (
        <Text style={styles.secondary}>{t("尚无观察记录。")}</Text>
      ) : null}
      <ResearchRuleDrafts observations={items} />
    </View>
  );
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
    heading: { color: tokens.foreground, fontSize: 20, fontWeight: "600" },
    label: { color: tokens.foreground, fontSize: 17, fontWeight: "600" },
    body: { color: tokens.foreground, fontSize: 16, lineHeight: 25 },
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
    multiline: { minHeight: 112, paddingVertical: 12, textAlignVertical: "top" },
  });
}
