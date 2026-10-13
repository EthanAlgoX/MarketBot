import type { FinanceRunInputs } from "@marketbot/contracts";
import { FinanceRunInputsSchema } from "@marketbot/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { rpc } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { useThemedStyles } from "../lib/native";
import { errorText } from "../lib/user-error";
import { NativeActionButton } from "./native-action-button";

export function FinancialRunInputs({
  runId,
  recordId,
  tradingDate,
}: {
  runId: number;
  recordId: number;
  tradingDate: string;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
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
      const next = FinanceRunInputsSchema.parse(
        await rpc("finance/runInputs", { runId, recordId }),
      );
      if (
        next.runId !== runId ||
        next.recordId !== recordId ||
        (next.tradingDate !== null && next.tradingDate !== tradingDate)
      )
        throw new Error(t("归档记录与当前交易日不一致。"));
      if (generation.current === request) setValue(next);
    } catch (failure: unknown) {
      if (generation.current === request) setError(errorText(failure, t("无法读取归档行情输入")));
    } finally {
      if (generation.current === request) setBusy(false);
    }
  }
  return (
    <View style={styles.section}>
      <NativeActionButton
        label={open ? t("收起行情输入") : t("查看当时行情输入")}
        prominence="secondary"
        disabled={busy}
        busy={busy}
        onPress={() => (open ? setOpen(false) : void load())}
      />
      {open ? (
        <View style={styles.group}>
          <Text style={styles.caption}>
            {t("只读取该交易日归档的输入，不刷新网络行情。价格与成交量沿用原数据单位。")}
          </Text>
          {error ? (
            <>
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
              <NativeActionButton
                label={t("重试读取归档")}
                prominence="secondary"
                disabled={busy}
                onPress={() => void load()}
              />
            </>
          ) : null}
          {value ? (
            <>
              <Text style={styles.caption}>
                {t("截至交易日")} {value.tradingDate ?? "—"} · {t("基准收盘原值")}{" "}
                {value.benchmarkClose ?? "—"}
              </Text>
              {Object.entries(value.bars).map(([symbol, bars]) => (
                <InputSeries
                  key={symbol}
                  symbol={symbol}
                  bars={bars}
                  source={value.sources[symbol] ?? null}
                />
              ))}
              {!Object.keys(value.bars).length ? (
                <Text style={styles.caption}>{t("这条记录未保存行情输入。")}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
    </View>
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
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [page, setPage] = useState(0);
  const ordered = useMemo(
    () => bars.slice().sort((a, b) => (b.tradingDate ?? "").localeCompare(a.tradingDate ?? "")),
    [bars],
  );
  return (
    <View style={styles.section}>
      <Text style={styles.label}>
        {symbol} · {source ?? t("来源未记录")}
      </Text>
      <Text style={styles.caption}>
        {t("归档输入")} {bars.length} · {t("第")} {bars.length ? page * 20 + 1 : 0}–
        {Math.min((page + 1) * 20, bars.length)} · {t("按交易日由近到远")}
      </Text>
      {ordered.slice(page * 20, (page + 1) * 20).map((bar, index) => (
        <View key={`${bar.tradingDate}:${index}`} style={styles.bar}>
          <Text style={styles.label}>{bar.tradingDate ?? "—"}</Text>
          <Text selectable style={styles.body}>
            {t("开盘")} {bar.open ?? "—"} · {t("收盘")} {bar.close ?? "—"}
          </Text>
          <Text selectable style={styles.body}>
            {t("最高")} {bar.high ?? "—"} · {t("最低")} {bar.low ?? "—"}
          </Text>
          <Text selectable style={styles.caption}>
            {t("成交量")} {bar.volume ?? "—"} · {t("成交额")} {bar.amount ?? "—"}
          </Text>
          <Text style={styles.caption}>
            {t("开/收盘精度来源")} ·{" "}
            {bar.priceInputSource === "provider_decimal"
              ? t("原始十进制")
              : bar.priceInputSource === "normalized_float"
                ? t("浮点规范化")
                : t("精度来源未记录")}
          </Text>
        </View>
      ))}
      {ordered.length > 20 ? (
        <View style={styles.section}>
          <NativeActionButton
            label={t("较近输入")}
            prominence="secondary"
            disabled={page === 0}
            onPress={() => setPage(page - 1)}
          />
          <NativeActionButton
            label={t("更早输入")}
            prominence="secondary"
            disabled={(page + 1) * 20 >= ordered.length}
            onPress={() => setPage(page + 1)}
          />
        </View>
      ) : null}
    </View>
  );
}
function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    section: { gap: 12 },
    group: {
      gap: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.border,
      borderRadius: 12,
    },
    bar: {
      gap: 6,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.border,
    },
    label: { color: tokens.foreground, fontSize: 15, fontWeight: "600" },
    body: { color: tokens.foreground, fontSize: 14, lineHeight: 23 },
    caption: { color: tokens.mutedForeground, fontSize: 13, lineHeight: 20 },
    error: { color: tokens.destructive, fontSize: 15, lineHeight: 23 },
  });
}
