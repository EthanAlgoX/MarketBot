import { html, nothing } from "lit";

import type { AppViewState } from "./app-view-state";
import { parseAgentSessionKey } from "../../../src/routing/session-key.js";
import {
  TAB_GROUPS,
  subtitleForTabWithLanguage,
  titleForTabWithLanguage,
} from "./navigation";
import { icons } from "./icons";
import { formatAgo } from "./format";
import { refreshChatAvatar } from "./app-chat";
import { renderChat } from "./views/chat";
import { renderChannels } from "./views/channels";
import { renderCron } from "./views/cron";
import { renderLogs } from "./views/logs";
import { renderRuns } from "./views/runs";
import { renderOverview } from "./views/overview";
import { renderSessions } from "./views/sessions";
import { renderConfig } from "./views/config";
import { renderExecApprovalPrompt } from "./views/exec-approval";
import { renderGatewayUrlConfirmation } from "./views/gateway-url-confirmation";
import { renderDesk } from "./views/desk";
import { renderFlowRadar } from "./views/flow-radar";
import { renderMarketData } from "./views/market-data";
import { renderStocks } from "./views/stocks";
import {
  renderChatControls,
  renderLanguageToggle,
  renderTab,
  renderThemeToggle,
} from "./app-render.helpers";
import { loadChannels } from "./controllers/channels";
import { deleteSession, loadSessions, patchSession } from "./controllers/sessions";
import { loadChatHistory } from "./controllers/chat";
import {
  applyConfig,
  loadConfig,
  loadConfigSchema,
  runUpdate,
  saveConfig,
  updateConfigFormValue,
} from "./controllers/config";
import {
  addCronJob,
  loadCronRuns,
  removeCronJob,
  runCronJob,
  toggleCronJob,
} from "./controllers/cron";
import { loadLogs } from "./controllers/logs";
import { applyMag7Preset } from "./controllers/market-data";
import { loadRun, loadRuns } from "./controllers/runs";
import {
  DEFAULT_UI_STOCKS_PREFERENCES,
  type UiStocksPreferences,
} from "./storage";

const AVATAR_DATA_RE = /^data:/i;
const AVATAR_HTTP_RE = /^https?:\/\//i;

const UI_TEXT = {
  en: {
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
    controlUi: "Control UI",
    gatewayStatusTitle: "Gateway connection state",
    gateway: "Gateway",
    connected: "Connected",
    disconnected: "Disconnected",
    chatDisconnected: "Disconnected from gateway.",
    stocksPillTitle: "Latest saved Daily Stocks run date",
    stocks: "Stocks",
    resources: "Resources",
    docs: "Docs",
    docsTitle: "Docs (opens in new tab)",
    last: "Last",
    updated: "Updated",
    navGroups: {
      Chat: "Chat",
      Finance: "Finance",
      Control: "Control",
    },
  },
  zh: {
    expandSidebar: "展开侧边栏",
    collapseSidebar: "收起侧边栏",
    controlUi: "控制台",
    gatewayStatusTitle: "网关连接状态",
    gateway: "网关",
    connected: "已连接",
    disconnected: "未连接",
    chatDisconnected: "网关未连接。",
    stocksPillTitle: "最近保存的每日股票运行日期",
    stocks: "股票",
    resources: "资源",
    docs: "文档",
    docsTitle: "文档（新标签打开）",
    last: "最近",
    updated: "更新",
    navGroups: {
      Chat: "对话",
      Finance: "财务",
      Control: "控制",
    },
  },
} as const;

function resolveUiText(language: "en" | "zh") {
  return UI_TEXT[language] ?? UI_TEXT.en;
}

function resolveStocksPreferences(state: AppViewState): UiStocksPreferences {
  return {
    ...DEFAULT_UI_STOCKS_PREFERENCES,
    ...(state.settings.stocksPreferences ?? {}),
  };
}

function persistStocksPreferences(
  state: AppViewState,
  patch: Partial<UiStocksPreferences>,
) {
  const next = {
    ...resolveStocksPreferences(state),
    ...patch,
  };
  state.applySettings({
    ...state.settings,
    stocksPreferences: next,
  });
}

function parseFlowRadarCacheTtlMs(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.floor(parsed);
}



function resolveAssistantAvatarUrl(state: AppViewState): string | undefined {
  const list = state.agentsList?.agents ?? [];
  const parsed = parseAgentSessionKey(state.sessionKey);
  const agentId =
    parsed?.agentId ??
    state.agentsList?.defaultId ??
    "main";
  const agent = list.find((entry) => entry.id === agentId);
  const identity = agent?.identity;
  const candidate = identity?.avatarUrl ?? identity?.avatar;
  if (!candidate) return undefined;
  if (AVATAR_DATA_RE.test(candidate) || AVATAR_HTTP_RE.test(candidate)) return candidate;
  return identity?.avatarUrl;
}

export function renderApp(state: AppViewState) {
  const language = state.settings.language ?? "en";
  const text = resolveUiText(language);
  const chatDisabledReason = state.connected ? null : text.chatDisconnected;
  const isChat = state.tab === "chat";
  const chatFocus = isChat && (state.settings.chatFocusMode || state.onboarding || state.embed);
  const showThinking = state.onboarding ? false : state.settings.chatShowThinking;
  const assistantAvatarUrl = resolveAssistantAvatarUrl(state);
  const chatAvatarUrl = state.chatAvatarUrl ?? assistantAvatarUrl ?? null;
  const channelUpdated =
    state.channelsLastSuccess != null ? formatAgo(state.channelsLastSuccess) : null;

  return html`
    <div class="shell ${isChat ? "shell--chat" : ""} ${chatFocus ? "shell--chat-focus" : ""} ${state.settings.navCollapsed ? "shell--nav-collapsed" : ""} ${state.onboarding ? "shell--onboarding" : ""} ${state.embed ? "shell--embed" : ""}">
      <header class="topbar">
        <div class="topbar-left">
          <button
            class="nav-collapse-toggle"
            @click=${() =>
      state.applySettings({
        ...state.settings,
        navCollapsed: !state.settings.navCollapsed,
      })}
            title="${state.settings.navCollapsed ? text.expandSidebar : text.collapseSidebar}"
            aria-label="${state.settings.navCollapsed ? text.expandSidebar : text.collapseSidebar}"
          >
            <span class="nav-collapse-toggle__icon">${icons.menu}</span>
          </button>
          <div class="brand">
            <div class="brand-logo">
              <img src="./marketbot-mark.svg" alt="MarketBot" />
            </div>
          <div class="brand-text">
            <div class="brand-title">MarketBot</div>
            <div class="brand-sub">${text.controlUi}</div>
          </div>
        </div>
      </div>
        <div class="topbar-status">
          <div class="pill ${state.connected ? "ok" : "warn"}" title="${text.gatewayStatusTitle}">
            <span class="statusDot ${state.connected ? "ok" : "warn"}"></span>
            <span>${text.gateway}</span>
            <span class="mono">${state.connected ? text.connected : text.disconnected}</span>
          </div>
          ${state.stocksLast
      ? html`<div class="pill" title="${text.stocksPillTitle}">
                <span>${text.stocks}</span>
                <span class="mono">${state.stocksLast.dateIso}</span>
              </div>`
      : nothing}
          ${renderLanguageToggle(state)}
          ${renderThemeToggle(state)}
        </div>
      </header>
      <aside class="nav ${state.settings.navCollapsed ? "nav--collapsed" : ""}">
        ${TAB_GROUPS.map((group) => {
        const isGroupCollapsed = state.settings.navGroupsCollapsed[group.label] ?? false;
        const hasActiveTab = group.tabs.some((tab) => tab === state.tab);
        return html`
            <div class="nav-group ${isGroupCollapsed && !hasActiveTab ? "nav-group--collapsed" : ""}">
              <button
                class="nav-label"
                @click=${() => {
            const next = { ...state.settings.navGroupsCollapsed };
            next[group.label] = !isGroupCollapsed;
            state.applySettings({
              ...state.settings,
              navGroupsCollapsed: next,
            });
          }}
                aria-expanded=${!isGroupCollapsed}
              >
                <span class="nav-label__text">${text.navGroups[group.label] ?? group.label}</span>
                <span class="nav-label__chevron">${isGroupCollapsed ? "+" : "−"}</span>
              </button>
              <div class="nav-group__items">
                ${group.tabs.map((tab) => renderTab(state, tab))}
              </div>
            </div>
          `;
      })}
        <div class="nav-group nav-group--links">
          <div class="nav-label nav-label--static">
            <span class="nav-label__text">${text.resources}</span>
          </div>
          <div class="nav-group__items">
            <a
              class="nav-item nav-item--external"
              href="https://docs.marketbot.ai"
              target="_blank"
              rel="noreferrer"
              title="${text.docsTitle}"
            >
              <span class="nav-item__icon" aria-hidden="true">${icons.book}</span>
              <span class="nav-item__text">${text.docs}</span>
            </a>
          </div>
        </div>
      </aside>
      <main class="content ${isChat ? "content--chat" : ""}">
        <section class="content-header">
          <div>
            <div class="page-title">${titleForTabWithLanguage(state.tab, language)}</div>
            <div class="page-sub">${subtitleForTabWithLanguage(state.tab, language)}</div>
          </div>
          <div class="page-meta">
            ${state.tab === "stocks" && state.stocksLast
      ? html`<div class="pill" title="Latest saved daily run date">
                  <span>${text.last}</span>
                  <span class="mono">${state.stocksLast.dateIso}</span>
                </div>`
      : nothing}
            ${state.tab === "channels" && channelUpdated
      ? html`<div class="pill" title="Last successful channels snapshot refresh">
                  <span>${text.updated}</span>
                  <span class="mono">${channelUpdated}</span>
                </div>`
      : nothing}
            ${state.lastError
      ? html`<div class="pill danger">${state.lastError}</div>`
      : nothing}
            ${isChat ? renderChatControls(state) : nothing}
          </div>
        </section>

        ${state.tab === "desk"
      ? renderDesk({
        language,
        connected: state.connected,
        lastError: state.lastError,
        stocksLast: state.stocksLast,
        watchlistText: state.stocksWatchlistText,
        onOpenStocks: () => state.setTab("stocks"),
        onRunStocks: () => state.runStocks(),
        onOpenChannels: () => state.setTab("channels"),
        onOpenSessions: () => state.setTab("sessions"),
        onOpenCron: () => state.setTab("cron"),
        onOpenLogs: () => state.setTab("logs"),
        onOpenChat: () => state.setTab("chat"),
      })
      : nothing}

        ${state.tab === "overview"
      ? renderOverview({
        language,
        connected: state.connected,
        settings: state.settings,
        password: state.password,
        lastError: state.lastError,
        onSettingsChange: (next) => state.applySettings(next),
        onPasswordChange: (next) => (state.password = next),
        onSessionKeyChange: (next) => {
          state.sessionKey = next;
          state.chatMessage = "";
          state.resetToolStream();
          state.applySettings({
            ...state.settings,
            sessionKey: next,
            lastActiveSessionKey: next,
          });
          void state.loadAssistantIdentity();
        },
        onConnect: () => state.connect(),
        onRefresh: () => state.loadOverview(),
      })
      : nothing}

        ${state.tab === "config"
      ? renderConfig({
        language,
        raw: state.configRaw,
        originalRaw: state.configRawOriginal,
        valid: state.configValid,
        issues: state.configIssues,
        loading: state.configLoading,
        saving: state.configSaving,
        applying: state.configApplying,
        updating: state.updateRunning,
        connected: state.connected,
        schema: state.configSchema as import("./views/config-form.shared").JsonSchema | null,
        schemaLoading: state.configSchemaLoading,
        uiHints: state.configUiHints,
        formMode: state.configFormMode,
        formValue: state.configForm,
        originalValue: state.configFormOriginal,
        searchQuery: state.configSearchQuery,
        activeSection: state.configActiveSection,
        activeSubsection: state.configActiveSubsection,
        onRawChange: (next) => {
          state.configRaw = next;
          state.configFormDirty = true;
        },
        onFormModeChange: (next) => {
          if (state.configFormMode === next) return;
          if (next === "raw") {
            const base =
              state.configForm ??
              (state.configSnapshot?.config as Record<string, unknown> | null) ??
              {};
            state.configRaw = `${JSON.stringify(base, null, 2).trimEnd()}\n`;
          } else {
            try {
              const parsed = JSON.parse(state.configRaw) as Record<string, unknown>;
              if (parsed && typeof parsed === "object") {
                state.configForm = parsed;
              }
            } catch {
              // Keep existing form when raw parsing fails.
            }
          }
          state.configFormMode = next;
        },
        onFormPatch: (path, value) => updateConfigFormValue(state, path, value),
        onSearchChange: (next) => {
          state.configSearchQuery = next;
        },
        onSectionChange: (next) => {
          state.configActiveSection = next;
          state.configActiveSubsection = null;
        },
        onSubsectionChange: (next) => {
          state.configActiveSubsection = next;
        },
        onReload: () => {
          void Promise.all([loadConfigSchema(state), loadConfig(state)]);
        },
        onSave: () => {
          void saveConfig(state);
        },
        onApply: () => {
          void applyConfig(state);
        },
        onUpdate: () => {
          void runUpdate(state);
        },
      })
      : nothing}

        ${state.tab === "channels"
      ? renderChannels({
        language,
        connected: state.connected,
        loading: state.channelsLoading,
        snapshot: state.channelsSnapshot,
        lastError: state.channelsError,
        lastSuccessAt: state.channelsLastSuccess,
        whatsappMessage: state.whatsappLoginMessage,
        whatsappQrDataUrl: state.whatsappLoginQrDataUrl,
        whatsappConnected: state.whatsappLoginConnected,
        whatsappBusy: state.whatsappBusy,
        configSchema: state.configSchema,
        configSchemaLoading: state.configSchemaLoading,
        configForm: state.configForm,
        configUiHints: state.configUiHints,
        configSaving: state.configSaving,
        configFormDirty: state.configFormDirty,
        nostrProfileFormState: state.nostrProfileFormState,
        nostrProfileAccountId: state.nostrProfileAccountId,
        onRefresh: (probe) => loadChannels(state, probe),
        onWhatsAppStart: (force) => state.handleWhatsAppStart(force),
        onWhatsAppWait: () => state.handleWhatsAppWait(),
        onWhatsAppLogout: () => state.handleWhatsAppLogout(),
        onConfigPatch: (path, value) => updateConfigFormValue(state, path, value),
        onConfigSave: () => state.handleChannelConfigSave(),
        onConfigReload: () => state.handleChannelConfigReload(),
        onNostrProfileEdit: (accountId, profile) =>
          state.handleNostrProfileEdit(accountId, profile),
        onNostrProfileCancel: () => state.handleNostrProfileCancel(),
        onNostrProfileFieldChange: (field, value) =>
          state.handleNostrProfileFieldChange(field, value),
        onNostrProfileSave: () => state.handleNostrProfileSave(),
        onNostrProfileImport: () => state.handleNostrProfileImport(),
        onNostrProfileToggleAdvanced: () => state.handleNostrProfileToggleAdvanced(),
      })
      : nothing}



        ${state.tab === "stocks"
      ? renderStocks({
        language,
        loading: state.stocksLoading,
        running: state.stocksRunning,
        error: state.stocksError,
        watchlistText: state.stocksWatchlistText,
        timeframe: state.stocksTimeframe,
        reportType: state.stocksReportType,
        includeFundamentals: state.stocksIncludeFundamentals,
        newsLimit: state.stocksNewsLimit,
        locale: state.stocksLocale,
        last: state.stocksLast,
        onWatchlistTextChange: (next) => (state.stocksWatchlistText = next),
        onTimeframeChange: (next) => {
          state.stocksTimeframe = next;
          persistStocksPreferences(state, { timeframe: next });
        },
        onReportTypeChange: (next) => {
          state.stocksReportType = next;
          state.stocksIncludeFundamentals = next === "full";
          persistStocksPreferences(state, {
            reportType: next,
            includeFundamentals: next === "full",
          });
        },
        onIncludeFundamentalsChange: (next) => {
          state.stocksIncludeFundamentals = next;
          persistStocksPreferences(state, { includeFundamentals: next });
        },
        onNewsLimitChange: (next) => {
          state.stocksNewsLimit = next;
          persistStocksPreferences(state, { newsLimit: next });
        },
        onLocaleChange: (next) => {
          state.stocksLocale = next;
          persistStocksPreferences(state, { locale: next });
        },
        onRefresh: () => state.loadStocks(),
        onSaveWatchlist: () => state.saveStocksWatchlist(),
        onRun: () => state.runStocks(),
      })
      : nothing}

        ${state.tab === "marketData"
      ? renderMarketData({
        language,
        loading: state.marketDataLoading,
        error: state.marketDataError,
        symbolsText: state.marketDataSymbolsText,
        timeframe: state.marketDataTimeframe,
        newsLimit: state.marketDataNewsLimit,
        activeSymbol: state.marketDataActiveSymbol,
        status: state.marketDataStatus,
        snapshot: state.marketDataSnapshot,
        onSymbolsTextChange: (next) => (state.marketDataSymbolsText = next),
        onTimeframeChange: (next) => (state.marketDataTimeframe = next),
        onNewsLimitChange: (next) => (state.marketDataNewsLimit = next),
        onActiveSymbolChange: (next) => (state.marketDataActiveSymbol = next),
        onApplyMag7: () =>
          applyMag7Preset(state as unknown as Parameters<typeof applyMag7Preset>[0]),
        onRefreshStatus: () => state.loadMarketDataStatus(),
        onRun: () => state.runMarketDataSnapshot(),
      })
      : nothing}

        ${state.tab === "flowRadar"
      ? renderFlowRadar({
        language,
        loading: state.flowRadarLoading,
        detailLoading: state.flowRadarDetailLoading,
        error: state.flowRadarError,
        snapshot: state.flowRadarSnapshot,
        detail: state.flowRadarDetail,
        activeAssetClass: state.flowRadarActiveAssetClass,
        activeSymbol: state.flowRadarActiveSymbol,
        cacheTtlMsText: state.flowRadarCacheTtlMsText,
        onCacheTtlMsTextChange: (next) => (state.flowRadarCacheTtlMsText = next),
        onRefresh: () =>
          state.runFlowRadarSnapshot({
            cacheTtlMs: parseFlowRadarCacheTtlMs(state.flowRadarCacheTtlMsText),
          }),
        onForceRefresh: () =>
          state.runFlowRadarSnapshot({
            refresh: true,
            cacheTtlMs: parseFlowRadarCacheTtlMs(state.flowRadarCacheTtlMsText),
          }),
        onSelect: (assetClass, symbol) =>
          state.loadFlowRadarDetail({
            assetClass,
            symbol,
            cacheTtlMs: parseFlowRadarCacheTtlMs(state.flowRadarCacheTtlMsText),
          }),
      })
      : nothing}

        ${state.tab === "sessions"
      ? renderSessions({
        language,
        loading: state.sessionsLoading,
        result: state.sessionsResult,
        error: state.sessionsError,
        activeMinutes: state.sessionsFilterActive,
        limit: state.sessionsFilterLimit,
        includeGlobal: state.sessionsIncludeGlobal,
        includeUnknown: state.sessionsIncludeUnknown,
        basePath: state.basePath,
        onFiltersChange: (next) => {
          state.sessionsFilterActive = next.activeMinutes;
          state.sessionsFilterLimit = next.limit;
          state.sessionsIncludeGlobal = next.includeGlobal;
          state.sessionsIncludeUnknown = next.includeUnknown;
        },
        onRefresh: () => loadSessions(state),
        onPatch: (key, patch) => patchSession(state, key, patch),
        onDelete: (key) => deleteSession(state, key),
      })
      : nothing}

        ${state.tab === "cron"
      ? renderCron({
        language,
        loading: state.cronLoading,
        status: state.cronStatus,
        jobs: state.cronJobs,
        error: state.cronError,
        busy: state.cronBusy,
        form: state.cronForm,
        channels: state.channelsSnapshot?.channelMeta?.length
          ? state.channelsSnapshot.channelMeta.map((entry) => entry.id)
          : state.channelsSnapshot?.channelOrder ?? [],
        channelLabels: state.channelsSnapshot?.channelLabels ?? {},
        channelMeta: state.channelsSnapshot?.channelMeta ?? [],
        runsJobId: state.cronRunsJobId,
        runs: state.cronRuns,
        onFormChange: (patch) => (state.cronForm = { ...state.cronForm, ...patch }),
        onRefresh: () => state.loadCron(),
        onAdd: () => addCronJob(state),
        onToggle: (job, enabled) => toggleCronJob(state, job, enabled),
        onRun: (job) => runCronJob(state, job),
        onRemove: (job) => removeCronJob(state, job),
        onLoadRuns: (jobId) => loadCronRuns(state, jobId),
      })
      : nothing}









        ${state.tab === "chat"
      ? renderChat({
        sessionKey: state.sessionKey,
        onSessionKeyChange: (next) => {
          state.sessionKey = next;
          state.chatMessage = "";
          state.chatAttachments = [];
          state.chatStream = null;
          state.chatStreamStartedAt = null;
          state.chatRunId = null;
          state.chatQueue = [];
          state.resetToolStream();
          state.resetChatScroll();
          state.applySettings({
            ...state.settings,
            sessionKey: next,
            lastActiveSessionKey: next,
          });
          void state.loadAssistantIdentity();
          void loadChatHistory(state);
          void refreshChatAvatar(state);
        },
        thinkingLevel: state.chatThinkingLevel,
        showThinking,
        loading: state.chatLoading,
        sending: state.chatSending,
        compactionStatus: state.compactionStatus,
        assistantAvatarUrl: chatAvatarUrl,
        messages: state.chatMessages,
        toolMessages: state.chatToolMessages,
        stream: state.chatStream,
        streamStartedAt: state.chatStreamStartedAt,
        draft: state.chatMessage,
        queue: state.chatQueue,
        connected: state.connected,
        canSend: state.connected,
        disabledReason: chatDisabledReason,
        error: state.lastError,
        sessions: state.sessionsResult,
        focusMode: chatFocus,
        onRefresh: () => {
          state.resetToolStream();
          return Promise.all([loadChatHistory(state), refreshChatAvatar(state)]);
        },
        onToggleFocusMode: () => {
          if (state.onboarding) return;
          state.applySettings({
            ...state.settings,
            chatFocusMode: !state.settings.chatFocusMode,
          });
        },
        onChatScroll: (event) => state.handleChatScroll(event),
        onDraftChange: (next) => (state.chatMessage = next),
        attachments: state.chatAttachments,
        onAttachmentsChange: (next) => (state.chatAttachments = next),
        onSend: () => state.handleSendChat(),
        canAbort: Boolean(state.chatRunId),
        onAbort: () => void state.handleAbortChat(),
        onQueueRemove: (id) => state.removeQueuedMessage(id),
        onNewSession: () =>
          state.handleSendChat("/new", { restoreDraft: true }),
        // Sidebar props for tool output viewing
        sidebarOpen: state.sidebarOpen,
        sidebarContent: state.sidebarContent,
        sidebarError: state.sidebarError,
        splitRatio: state.splitRatio,
        onOpenSidebar: (content: string) => state.handleOpenSidebar(content),
        onCloseSidebar: () => state.handleCloseSidebar(),
        onSplitRatioChange: (ratio: number) => state.handleSplitRatioChange(ratio),
        assistantName: state.assistantName,
        assistantAvatar: state.assistantAvatar,
        language,
      })
      : nothing}

        ${state.tab === "logs"
      ? renderLogs({
        language,
        loading: state.logsLoading,
        error: state.logsError,
        file: state.logsFile,
        entries: state.logsEntries,
        filterText: state.logsFilterText,
        levelFilters: state.logsLevelFilters,
        autoFollow: state.logsAutoFollow,
        truncated: state.logsTruncated,
        onFilterTextChange: (next) => (state.logsFilterText = next),
        onLevelToggle: (level, enabled) => {
          state.logsLevelFilters = { ...state.logsLevelFilters, [level]: enabled };
        },
        onToggleAutoFollow: (next) => (state.logsAutoFollow = next),
        onRefresh: () => loadLogs(state, { reset: true }),
        onExport: (lines, label) => state.exportLogs(lines, label),
        onScroll: (event) => state.handleLogsScroll(event),
      })
      : nothing}

        ${state.tab === "runs"
      ? renderRuns({
        language,
        loading: state.runsLoading,
        error: state.runsError,
        runs: state.runs,
        selectedRunId: state.runsSelectedRunId,
        runLoading: state.runLoading,
        runError: state.runError,
        runEvents: state.runEvents,
        runTruncated: state.runTruncated,
        streamsFilter: state.runStreamsFilter,
        replayIndex: state.runReplayIndex,
        onRefreshRuns: () => loadRuns(state),
        onSelectRun: (runId) => {
          state.runsSelectedRunId = runId;
          state.runReplayIndex = 0;
          void loadRun(state, runId);
        },
        onRefreshRun: () => {
          const runId = state.runsSelectedRunId;
          if (!runId) return;
          void loadRun(state, runId);
        },
        onToggleStream: (stream, enabled) => {
          state.runStreamsFilter = { ...state.runStreamsFilter, [stream]: enabled };
        },
        onReplayIndex: (next) => (state.runReplayIndex = next),
      })
      : nothing}
      </main>
      ${renderExecApprovalPrompt(state)}
      ${renderGatewayUrlConfirmation(state)}
    </div>
  `;
}
