import type {
  FinanceWatchlistCommand,
  FinanceWatchlistCommandResult,
  FinanceWorkspaceOverview,
} from "@marketbot/contracts";
import {
  FinanceWatchlistCommandResultSchema,
  FinanceWatchlistCommandSchema,
} from "@marketbot/contracts";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { useFinanceIntent, useFinanceSession } from "../lib/use-finance-session";
import { errorText } from "../lib/user-error";
import { MenuPicker } from "./menu-picker";
import { NativeActionButton } from "./native-action-button";

export function FinancialWatchlist({
  data,
  onChanged,
  onRefresh,
}: {
  data: FinanceWorkspaceOverview;
  onChanged: (result: FinanceWatchlistCommandResult) => void;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [market, setMarket] = useState<"cn" | "crypto">("cn");
  const [symbol, setSymbol] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<FinanceWatchlistCommand | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkedMissing, setCheckedMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useFinanceSession(setError);
  const storageKey = useFinanceIntent(
    session,
    "watchlist",
    FinanceWatchlistCommandSchema,
    setPending,
    setError,
    t("无法恢复操作记录，暂不能修改自选"),
  );

  async function applied(result: FinanceWatchlistCommandResult) {
    await clearStoredIntent();
    if (!session?.isCurrent()) return;
    onChanged(result);
    setPending(null);
    setError(null);
    setCheckedMissing(false);
    if (result.commandType === "watchlist.add") {
      setSymbol("");
      setReason("");
    }
  }
  async function clearStoredIntent() {
    if (!session?.isCurrent() || !storageKey) throw new Error("Financial session changed");
    await session.clear(storageKey);
  }
  async function send(command: FinanceWatchlistCommand) {
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
    setError(null);
    setCheckedMissing(false);
    try {
      await applied(
        FinanceWatchlistCommandResultSchema.parse(
          await session!.request("finance/watchlistCommand", command),
        ),
      );
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      const code =
        failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (["BAD_REQUEST", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(code)) {
        try {
          await clearStoredIntent();
        } catch {
          if (session?.isCurrent()) setError(t("无法清理本地操作记录，请保留原编号查询结果。"));
          return;
        }
        if (!session?.isCurrent()) return;
        setPending(null);
        onRefresh();
        setError(errorText(failure, t("操作未应用，请刷新后再试")));
      } else {
        setError(t("尚未确认操作结果，请先查询；重试会保留原操作编号。"));
      }
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }
  async function checkResult() {
    if (!pending || busy || !session?.isCurrent()) return;
    setBusy(true);
    setError(null);
    try {
      const value = await session!.request<unknown>("finance/commandStatus", {
        commandType: pending.commandType,
        idempotencyKey: pending.idempotencyKey,
      });
      if (value) await applied(FinanceWatchlistCommandResultSchema.parse(value));
      else {
        setCheckedMissing(true);
        setError(t("暂未查到结果，可以重试同一操作。"));
      }
    } catch (failure: unknown) {
      if (!session?.isCurrent()) return;
      setError(errorText(failure, t("暂时无法查询，请稍后再查")));
    } finally {
      if (session?.isCurrent()) setBusy(false);
    }
  }

  if (!session) return <Text accessibilityRole="alert">{error ?? t("正在确认金融会话…")}</Text>;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t("关注标的")}
      </Text>
      <View style={styles.group}>
        {data.watchlist.length ? (
          data.watchlist.map((asset) => (
            <View key={asset.assetId} style={styles.row}>
              <Text style={styles.label}>{asset.name || asset.symbol}</Text>
              <Text style={styles.caption}>
                {asset.symbol} · {asset.market.toUpperCase()} · {asset.currency}
              </Text>
              {asset.reason ? <Text style={styles.secondary}>{asset.reason}</Text> : null}
              {data.capabilities.supportedCommands.includes("watchlist.remove") &&
              (asset.market === "cn" || asset.market === "crypto") ? (
                <NativeActionButton
                  label={t("移除")}
                  accessibilityLabel={t("移除 {name}", { name: asset.name || asset.symbol })}
                  prominence="quiet"
                  disabled={!storageKey || busy || pending !== null}
                  onPress={() =>
                    void send({
                      commandType: "watchlist.remove",
                      idempotencyKey: newIntentKey(),
                      expectedRevision: data.watchlistRevision,
                      symbol: asset.symbol,
                      market: asset.market as "cn" | "crypto",
                    })
                  }
                />
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.empty}>{t("金融工作区还没有自选标的。")}</Text>
        )}
      </View>
      {data.capabilities.supportedCommands.includes("watchlist.add") ? (
        <View style={styles.form}>
          <View pointerEvents={!storageKey || busy || pending ? "none" : "auto"}>
            <MenuPicker
              label={t("市场")}
              value={market}
              choices={[
                { key: "cn", label: t("A 股") },
                { key: "crypto", label: t("加密现货") },
              ]}
              onChange={(value) => setMarket(value as "cn" | "crypto")}
            />
          </View>
          <Text style={styles.caption}>{t("代码")}</Text>
          <TextInput
            accessibilityLabel={t("代码")}
            value={symbol}
            onChangeText={setSymbol}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={64}
            placeholder={market === "cn" ? "600519" : "BTCUSDT"}
            placeholderTextColor={native.secondaryLabel}
            editable={storageKey !== null && !busy && pending === null}
            style={styles.input}
          />
          <Text style={styles.caption}>{t("关注原因（可选）")}</Text>
          <TextInput
            accessibilityLabel={t("关注原因（可选）")}
            value={reason}
            onChangeText={setReason}
            maxLength={1000}
            editable={storageKey !== null && !busy && pending === null}
            style={styles.input}
          />
          <NativeActionButton
            label={t("加入自选")}
            disabled={!storageKey || busy || pending !== null || !symbol.trim()}
            onPress={() =>
              void send({
                commandType: "watchlist.add",
                idempotencyKey: newIntentKey(),
                expectedRevision: data.watchlistRevision,
                symbol: symbol.trim(),
                market,
                ...(reason.trim() ? { reason: reason.trim() } : {}),
              })
            }
          />
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.warning}>
          {error}
        </Text>
      ) : null}
      {pending ? (
        <View style={styles.form}>
          <NativeActionButton
            label={t("查询操作结果")}
            prominence="secondary"
            disabled={busy}
            onPress={() => void checkResult()}
          />
          {checkedMissing ? (
            <NativeActionButton
              label={t("重试同一操作")}
              prominence="secondary"
              disabled={busy}
              onPress={() => void send(pending)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Intent nonce, never an authentication credential. A collision is rejected by the server hash. */
function newIntentKey() {
  const random = globalThis.crypto;
  return `watchlist:${random && typeof random.randomUUID === "function" ? random.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`;
}
function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    section: { gap: 12 },
    heading: { color: tokens.foreground, fontSize: 20, fontWeight: "600" },
    group: { borderRadius: 14, backgroundColor: native.groupedCell, overflow: "hidden" },
    row: {
      padding: 16,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.border,
    },
    label: { color: tokens.foreground, fontSize: 17, fontWeight: "600" },
    caption: { color: tokens.mutedForeground, fontSize: 13, lineHeight: 20 },
    secondary: { color: tokens.mutedForeground, fontSize: 15, lineHeight: 23 },
    empty: { padding: 16, color: tokens.mutedForeground, fontSize: 15, lineHeight: 23 },
    warning: { color: tokens.warning, fontSize: 15, lineHeight: 23 },
    form: { gap: 10 },
    input: {
      backgroundColor: native.groupedCell,
      color: tokens.foreground,
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 10,
      minHeight: 48,
      paddingHorizontal: 14,
      fontSize: 17,
    },
  });
}
