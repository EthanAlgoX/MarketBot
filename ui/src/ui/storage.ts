const KEY = "marketbot.control.settings.v1";

import type { ThemeMode } from "./theme";

export type UiLanguage = "en" | "zh";
export type UiStocksPreferences = {
  timeframe: string;
  reportType: "simple" | "full";
  includeFundamentals: boolean;
  newsLimit: string;
  locale: string;
};

export const DEFAULT_UI_STOCKS_PREFERENCES: UiStocksPreferences = {
  timeframe: "6mo",
  reportType: "simple",
  includeFundamentals: false,
  newsLimit: "2",
  locale: "US",
};

export type UiSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: ThemeMode;
  language: UiLanguage;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number; // Sidebar split ratio (0.4 to 0.7, default 0.6)
  navCollapsed: boolean; // Collapsible sidebar state
  navGroupsCollapsed: Record<string, boolean>; // Which nav groups are collapsed
  stocksPreferences?: UiStocksPreferences;
};

export function loadSettings(): UiSettings {
  const defaultUrl = (() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}`;
  })();

  const defaults: UiSettings = {
    gatewayUrl: defaultUrl,
    token: "",
    sessionKey: "main",
    lastActiveSessionKey: "main",
    theme: "system",
    language: "en",
    chatFocusMode: false,
    chatShowThinking: true,
    splitRatio: 0.6,
    navCollapsed: false,
    navGroupsCollapsed: {},
    stocksPreferences: { ...DEFAULT_UI_STOCKS_PREFERENCES },
  };

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    const parsedStocksPreferences =
      parsed.stocksPreferences && typeof parsed.stocksPreferences === "object"
        ? (parsed.stocksPreferences as Partial<UiStocksPreferences>)
        : null;

    return {
      gatewayUrl:
        typeof parsed.gatewayUrl === "string" && parsed.gatewayUrl.trim()
          ? parsed.gatewayUrl.trim()
          : defaults.gatewayUrl,
      token: typeof parsed.token === "string" ? parsed.token : defaults.token,
      sessionKey:
        typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()
          ? parsed.sessionKey.trim()
          : defaults.sessionKey,
      lastActiveSessionKey:
        typeof parsed.lastActiveSessionKey === "string" &&
        parsed.lastActiveSessionKey.trim()
          ? parsed.lastActiveSessionKey.trim()
          : (typeof parsed.sessionKey === "string" &&
              parsed.sessionKey.trim()) ||
            defaults.lastActiveSessionKey,
      theme:
        parsed.theme === "light" ||
        parsed.theme === "dark" ||
        parsed.theme === "system"
          ? parsed.theme
          : defaults.theme,
      language: parsed.language === "zh" ? "zh" : defaults.language,
      chatFocusMode:
        typeof parsed.chatFocusMode === "boolean"
          ? parsed.chatFocusMode
          : defaults.chatFocusMode,
      chatShowThinking:
        typeof parsed.chatShowThinking === "boolean"
          ? parsed.chatShowThinking
          : defaults.chatShowThinking,
      splitRatio:
        typeof parsed.splitRatio === "number" &&
        parsed.splitRatio >= 0.4 &&
        parsed.splitRatio <= 0.7
          ? parsed.splitRatio
          : defaults.splitRatio,
      navCollapsed:
        typeof parsed.navCollapsed === "boolean"
          ? parsed.navCollapsed
          : defaults.navCollapsed,
      navGroupsCollapsed:
        typeof parsed.navGroupsCollapsed === "object" &&
        parsed.navGroupsCollapsed !== null
          ? parsed.navGroupsCollapsed
          : defaults.navGroupsCollapsed,
      stocksPreferences: {
        timeframe:
          typeof parsedStocksPreferences?.timeframe === "string" &&
          parsedStocksPreferences.timeframe.trim()
            ? parsedStocksPreferences.timeframe.trim()
            : defaults.stocksPreferences?.timeframe ?? DEFAULT_UI_STOCKS_PREFERENCES.timeframe,
        reportType:
          parsedStocksPreferences?.reportType === "full"
            ? "full"
            : defaults.stocksPreferences?.reportType ?? DEFAULT_UI_STOCKS_PREFERENCES.reportType,
        includeFundamentals:
          typeof parsedStocksPreferences?.includeFundamentals === "boolean"
            ? parsedStocksPreferences.includeFundamentals
            : defaults.stocksPreferences?.includeFundamentals ??
              DEFAULT_UI_STOCKS_PREFERENCES.includeFundamentals,
        newsLimit:
          typeof parsedStocksPreferences?.newsLimit === "string" &&
          parsedStocksPreferences.newsLimit.trim()
            ? parsedStocksPreferences.newsLimit.trim()
            : defaults.stocksPreferences?.newsLimit ?? DEFAULT_UI_STOCKS_PREFERENCES.newsLimit,
        locale:
          typeof parsedStocksPreferences?.locale === "string" &&
          parsedStocksPreferences.locale.trim()
            ? parsedStocksPreferences.locale.trim()
            : defaults.stocksPreferences?.locale ?? DEFAULT_UI_STOCKS_PREFERENCES.locale,
      },
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(next: UiSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
}
