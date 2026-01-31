/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import {
  CombinedAutocompleteProvider,
  Container,
  Loader,
  ProcessTerminal,
  Text,
  TUI,
} from "@mariozechner/pi-tui";
import { resolveDefaultAgentId } from "../agents/agent-scope.js";
import { loadConfig } from "../config/config.js";
import {
  buildAgentMainSessionKey,
  normalizeAgentId,
  normalizeMainKey,
  parseAgentSessionKey,
} from "../routing/session-key.js";
import { formatRelativeTime } from "../utils/time-format.js";
import { getSlashCommands } from "./commands.js";
import { ChatLog } from "./components/chat-log.js";
import { CustomEditor } from "./components/custom-editor.js";
import { GatewayChatClient } from "./gateway-chat.js";
import { editorTheme, theme } from "./theme/theme.js";
import { createCommandHandlers } from "./tui-command-handlers.js";
import { createEventHandlers } from "./tui-event-handlers.js";
import { formatTokens } from "./tui-formatters.js";
import { createLocalShellRunner } from "./tui-local-shell.js";
import { buildWaitingStatusMessage, defaultWaitingPhrases } from "./tui-waiting.js";
import { createOverlayHandlers } from "./tui-overlays.js";
import { createSessionActions } from "./tui-session-actions.js";
import type {
  AgentSummary,
  SessionInfo,
  SessionScope,
  TuiOptions,
  TuiStateAccess,
} from "./tui-types.js";

export { resolveFinalAssistantText } from "./tui-formatters.js";
export type { TuiOptions } from "./tui-types.js";

export function createEditorSubmitHandler(params: {
  editor: {
    setText: (value: string) => void;
    addToHistory: (value: string) => void;
  };
  handleCommand: (value: string) => Promise<void> | void;
  sendMessage: (value: string) => Promise<void> | void;
  handleBangLine: (value: string) => Promise<void> | void;
}) {
  return (text: string) => {
    const raw = text;
    const value = raw.trim();
    params.editor.setText("");

    // Keep previous behavior: ignore empty/whitespace-only submissions.
    if (!value) {
      return;
    }

    // Bash mode: only if the very first character is '!' and it's not just '!'.
    // IMPORTANT: use the raw (untrimmed) text so leading spaces do NOT trigger.
    // Per requirement: a lone '!' should be treated as a normal message.
    if (raw.startsWith("!") && raw !== "!") {
      params.editor.addToHistory(raw);
      void params.handleBangLine(raw);
      return;
    }

    // Enable built-in editor prompt history navigation (up/down).
    params.editor.addToHistory(value);

    if (value.startsWith("/")) {
      void params.handleCommand(value);
      return;
    }

    void params.sendMessage(value);
  };
}

export async function runTui(opts: TuiOptions) {
  const config = loadConfig();

  // Helper to check if a provider has a valid key configured in env or config
  const checkProviderConfiguredAtStart = (provider?: string): boolean => {
    if (!provider) return false;
    const p = provider.toLowerCase();

    // Check initial config first
    if (config.models?.providers) {
      const provCfg = config.models.providers[p] as any;
      if (provCfg?.apiKey && !provCfg.apiKey.includes("placeholder")) {
        return true;
      }
    }

    let key = "";
    if (p.includes("deepseek")) key = process.env.DEEPSEEK_API_KEY ?? "";
    else if (p.includes("openai")) key = process.env.OPENAI_API_KEY ?? "";
    else if (p.includes("anthropic")) key = process.env.ANTHROPIC_API_KEY ?? "";
    else if (p.includes("gemini")) key = process.env.GEMINI_API_KEY ?? "";
    else return true;

    if (!key || /placeholder/i.test(key) || key === "") return false;
    return true;
  };
  const initialSessionInput = (opts.session ?? "").trim();
  let sessionScope: SessionScope = (config.session?.scope ?? "per-sender") as SessionScope;
  let sessionMainKey = normalizeMainKey(config.session?.mainKey);
  let agentDefaultId = resolveDefaultAgentId(config);
  let currentAgentId = agentDefaultId;
  let agents: AgentSummary[] = [];
  const agentNames = new Map<string, string>();
  let currentSessionKey = "";
  let initialSessionApplied = false;
  let currentSessionId: string | null = null;
  let activeChatRunId: string | null = null;
  let historyLoaded = false;
  let isConnected = false;
  let wasDisconnected = false;
  let toolsExpanded = false;
  let showThinking = false;
  const watchlist: string[] = [];

  const deliverDefault = opts.deliver ?? false;
  const autoMessage = opts.message?.trim();
  let autoMessageSent = false;
  let sessionInfo: SessionInfo = {};
  let lastCtrlCAt = 0;
  let activityStatus = "idle";
  let connectionStatus = "connecting";
  let statusTimeout: NodeJS.Timeout | null = null;
  let statusTimer: NodeJS.Timeout | null = null;
  let statusStartedAt: number | null = null;
  let lastActivityStatus = activityStatus;

  const state: TuiStateAccess = {
    get agentDefaultId() {
      return agentDefaultId;
    },
    set agentDefaultId(value) {
      agentDefaultId = value;
    },
    get sessionMainKey() {
      return sessionMainKey;
    },
    set sessionMainKey(value) {
      sessionMainKey = value;
    },
    get sessionScope() {
      return sessionScope;
    },
    set sessionScope(value) {
      sessionScope = value;
    },
    get agents() {
      return agents;
    },
    set agents(value) {
      agents = value;
    },
    get currentAgentId() {
      return currentAgentId;
    },
    set currentAgentId(value) {
      currentAgentId = value;
    },
    get currentSessionKey() {
      return currentSessionKey;
    },
    set currentSessionKey(value) {
      currentSessionKey = value;
    },
    get currentSessionId() {
      return currentSessionId;
    },
    set currentSessionId(value) {
      currentSessionId = value;
    },
    get activeChatRunId() {
      return activeChatRunId;
    },
    set activeChatRunId(value) {
      activeChatRunId = value;
    },
    get historyLoaded() {
      return historyLoaded;
    },
    set historyLoaded(value) {
      historyLoaded = value;
    },
    get sessionInfo() {
      return sessionInfo;
    },
    set sessionInfo(value) {
      sessionInfo = value;
    },
    get initialSessionApplied() {
      return initialSessionApplied;
    },
    set initialSessionApplied(value) {
      initialSessionApplied = value;
    },
    get isConnected() {
      return isConnected;
    },
    set isConnected(value) {
      isConnected = value;
    },
    get autoMessageSent() {
      return autoMessageSent;
    },
    set autoMessageSent(value) {
      autoMessageSent = value;
    },
    get toolsExpanded() {
      return toolsExpanded;
    },
    set toolsExpanded(value) {
      toolsExpanded = value;
    },
    get showThinking() {
      return showThinking;
    },
    set showThinking(value) {
      showThinking = value;
    },
    get connectionStatus() {
      return connectionStatus;
    },
    set connectionStatus(value) {
      connectionStatus = value;
    },
    get activityStatus() {
      return activityStatus;
    },
    set activityStatus(value) {
      activityStatus = value;
    },
    get statusTimeout() {
      return statusTimeout;
    },
    set statusTimeout(value) {
      statusTimeout = value;
    },
    get lastCtrlCAt() {
      return lastCtrlCAt;
    },
    set lastCtrlCAt(value) {
      lastCtrlCAt = value;
    },
  };

  const client = new GatewayChatClient({
    url: opts.url,
    token: opts.token,
    password: opts.password,
  });

  const tui = new TUI(new ProcessTerminal());
  const header = new Text("", 0, 0);
  const subheader = new Text("", 0, 0);
  const sessionBar = new Text("", 0, 0);
  const watchlistBar = new Text("", 0, 0);
  const statusContainer = new Container();
  const shortcutsBar = new Text("", 0, 0);
  const chatLog = new ChatLog();
  const editor = new CustomEditor(tui, editorTheme);
  const root = new Container();
  root.addChild(header);
  root.addChild(subheader);
  root.addChild(sessionBar);
  root.addChild(watchlistBar);
  root.addChild(chatLog);
  root.addChild(statusContainer);
  root.addChild(shortcutsBar);
  root.addChild(editor);

  const updateAutocompleteProvider = () => {
    editor.setAutocompleteProvider(
      new CombinedAutocompleteProvider(
        getSlashCommands({
          cfg: config,
          provider: sessionInfo.modelProvider,
          model: sessionInfo.model,
        }),
        process.cwd(),
      ),
    );
  };

  tui.addChild(root);
  tui.setFocus(editor);

  const formatSessionKey = (key: string) => {
    if (key === "global" || key === "unknown") {
      return key;
    }
    const parsed = parseAgentSessionKey(key);
    return parsed?.rest ?? key;
  };

  const formatAgentLabel = (id: string) => {
    const name = agentNames.get(id);
    return name ? `${id} (${name})` : id;
  };

  const resolveSessionKey = (raw?: string) => {
    const trimmed = (raw ?? "").trim();
    if (sessionScope === "global") {
      return "global";
    }
    if (!trimmed) {
      return buildAgentMainSessionKey({
        agentId: currentAgentId,
        mainKey: sessionMainKey,
      });
    }
    if (trimmed === "global" || trimmed === "unknown") {
      return trimmed;
    }
    if (trimmed.startsWith("agent:")) {
      return trimmed;
    }
    return `agent:${currentAgentId}:${trimmed}`;
  };

  currentSessionKey = resolveSessionKey(initialSessionInput);

  const formatConnectionLabel = () => {
    const lower = connectionStatus.toLowerCase();
    if (lower.includes("disconnected") || lower.includes("error")) {
      return theme.error(`o ${connectionStatus}`);
    }
    if (lower.includes("connecting") || lower.includes("reconnecting") || lower.includes("gap")) {
      return theme.warning(`o ${connectionStatus}`);
    }
    if (lower.includes("connected")) {
      return theme.success(`o ${connectionStatus}`);
    }
    return theme.neutral(`o ${connectionStatus}`);
  };

  const formatActivityLabel = () => {
    const normalized = activityStatus || "idle";
    if (normalized === "idle") {
      return theme.dim(normalized);
    }
    if (normalized === "error") {
      return theme.error(normalized);
    }
    if (normalized === "aborted") {
      return theme.warning(normalized);
    }
    if (normalized === "waiting") {
      return theme.neutral(normalized);
    }
    if (normalized === "streaming") {
      return theme.accent(normalized);
    }
    if (normalized === "sending") {
      return theme.accentSoft(normalized);
    }
    if (normalized === "running") {
      return theme.marketInfo(normalized);
    }
    return theme.accentSoft(normalized);
  };

  const updateHeader = () => {
    header.setText(
      `${theme.header("MarketBot TUI")} ${theme.dim("|")} ${theme.dim(client.connection.url)}`,
    );
  };

  const updateSubheader = () => {
    const updatedLabel =
      typeof sessionInfo.updatedAt === "number" ? formatRelativeTime(sessionInfo.updatedAt) : "n/a";
    subheader.setText(
      `${formatConnectionLabel()} ${theme.dim("|")} ${theme.dim("activity")} ${formatActivityLabel()} ${theme.dim("|")} ${theme.dim("updated")} ${theme.dim(updatedLabel)}`,
    );
  };

  const updateSessionBar = () => {
    const sessionKeyLabel = formatSessionKey(currentSessionKey);
    const sessionLabel = sessionInfo.displayName
      ? `${sessionKeyLabel} (${sessionInfo.displayName})`
      : sessionKeyLabel;
    const agentLabel = formatAgentLabel(currentAgentId);
    const modelLabel = sessionInfo.model
      ? sessionInfo.modelProvider
        ? `${sessionInfo.modelProvider}/${sessionInfo.model}`
        : sessionInfo.model
      : "unknown";
    const tokens = formatTokens(sessionInfo.totalTokens ?? null, sessionInfo.contextTokens ?? null);
    const think = sessionInfo.thinkingLevel ?? "off";
    const verbose = sessionInfo.verboseLevel ?? "off";
    const reasoning = sessionInfo.reasoningLevel ?? "off";
    const usage = sessionInfo.responseUsage ?? "off";
    const reasoningLabel =
      reasoning === "on" ? "reasoning" : reasoning === "stream" ? "reasoning:stream" : null;
    const footerParts = [
      `agent ${agentLabel}`,
      `session ${sessionLabel}`,
      modelLabel,
      think !== "off" ? `think ${think}` : null,
      verbose !== "off" ? `verbose ${verbose}` : null,
      reasoningLabel,
      usage !== "off" ? `usage ${usage}` : null,
      tokens,
    ].filter(Boolean);
    sessionBar.setText(theme.dim(footerParts.join(" | ")));
    updateSubheader();
  };

  const updateWatchlistBar = () => {
    if (watchlist.length === 0) {
      watchlistBar.setText(
        `${theme.marketInfo("Watchlist")} ${theme.dim("|")} ${theme.dim("empty (use /watch <symbol>)")}`,
      );
      return;
    }
    const symbolList = watchlist.map((symbol) => theme.highlight(symbol)).join(", ");
    watchlistBar.setText(
      `${theme.marketInfo(`Watchlist (${watchlist.length})`)} ${theme.dim("|")} ${symbolList}`,
    );
  };

  const updateShortcutsBar = () => {
    shortcutsBar.setText(
      theme.dim(
        "Keys: Alt+Enter commands | Shift+Tab help | Ctrl+L model | Ctrl+G agent | Ctrl+P session | Ctrl+O tools | Ctrl+T thinking | Ctrl+C exit",
      ),
    );
  };

  const normalizeSymbol = (raw: string) => raw.trim().toUpperCase();
  const isValidSymbol = (symbol: string) => /^[A-Z0-9.\-]{1,12}$/.test(symbol);

  const addWatchSymbol = (raw: string) => {
    const symbol = normalizeSymbol(raw);
    if (!symbol) {
      return { ok: false, reason: "missing" as const, symbol };
    }
    if (!isValidSymbol(symbol)) {
      return { ok: false, reason: "invalid" as const, symbol };
    }
    if (watchlist.includes(symbol)) {
      return { ok: false, reason: "exists" as const, symbol };
    }
    watchlist.push(symbol);
    updateWatchlistBar();
    return { ok: true, symbol };
  };

  const removeWatchSymbol = (raw: string) => {
    const symbol = normalizeSymbol(raw);
    if (!symbol) {
      return { ok: false, reason: "missing" as const, symbol };
    }
    const idx = watchlist.indexOf(symbol);
    if (idx === -1) {
      return { ok: false, reason: "not_found" as const, symbol };
    }
    watchlist.splice(idx, 1);
    updateWatchlistBar();
    return { ok: true, symbol };
  };

  const getWatchlist = () => [...watchlist];

  const clearWatchlist = () => {
    watchlist.splice(0, watchlist.length);
    updateWatchlistBar();
  };

  const busyStates = new Set(["sending", "waiting", "streaming", "running"]);
  let statusText: Text | null = null;
  let statusLoader: Loader | null = null;

  const formatElapsed = (startMs: number) => {
    const totalSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  const ensureStatusText = () => {
    if (statusText) {
      return;
    }
    statusContainer.clear();
    statusLoader?.stop();
    statusLoader = null;
    statusText = new Text("", 1, 0);
    statusContainer.addChild(statusText);
  };

  const ensureStatusLoader = () => {
    if (statusLoader) {
      return;
    }
    statusContainer.clear();
    statusText = null;
    statusLoader = new Loader(
      tui,
      (spinner) => theme.accent(spinner),
      (text) => theme.bold(theme.accentSoft(text)),
      "",
    );
    statusContainer.addChild(statusLoader);
  };

  let waitingTick = 0;
  let waitingTimer: NodeJS.Timeout | null = null;
  let waitingPhrase: string | null = null;

  const updateBusyStatusMessage = () => {
    if (!statusLoader || !statusStartedAt) {
      return;
    }
    const elapsed = formatElapsed(statusStartedAt);

    if (activityStatus === "waiting") {
      waitingTick++;
      statusLoader.setMessage(
        buildWaitingStatusMessage({
          theme,
          tick: waitingTick,
          elapsed,
          connectionStatus,
          phrases: waitingPhrase ? [waitingPhrase] : undefined,
        }),
      );
      return;
    }

    statusLoader.setMessage(`${activityStatus} | ${elapsed} | ${connectionStatus}`);
  };

  const startStatusTimer = () => {
    if (statusTimer) {
      return;
    }
    statusTimer = setInterval(() => {
      if (!busyStates.has(activityStatus)) {
        return;
      }
      updateBusyStatusMessage();
    }, 1000);
  };

  const stopStatusTimer = () => {
    if (!statusTimer) {
      return;
    }
    clearInterval(statusTimer);
    statusTimer = null;
  };

  const startWaitingTimer = () => {
    if (waitingTimer) {
      return;
    }

    // Pick a phrase once per waiting session.
    if (!waitingPhrase) {
      const idx = Math.floor(Math.random() * defaultWaitingPhrases.length);
      waitingPhrase = defaultWaitingPhrases[idx] ?? defaultWaitingPhrases[0] ?? "waiting";
    }

    waitingTick = 0;

    waitingTimer = setInterval(() => {
      if (activityStatus !== "waiting") {
        return;
      }
      updateBusyStatusMessage();
    }, 120);
  };

  const stopWaitingTimer = () => {
    if (!waitingTimer) {
      return;
    }
    clearInterval(waitingTimer);
    waitingTimer = null;
    waitingPhrase = null;
  };

  const renderStatus = () => {
    const isBusy = busyStates.has(activityStatus);
    if (isBusy) {
      if (!statusStartedAt || lastActivityStatus !== activityStatus) {
        statusStartedAt = Date.now();
      }
      ensureStatusLoader();
      if (activityStatus === "waiting") {
        stopStatusTimer();
        startWaitingTimer();
      } else {
        stopWaitingTimer();
        startStatusTimer();
      }
      updateBusyStatusMessage();
    } else {
      statusStartedAt = null;
      stopStatusTimer();
      stopWaitingTimer();
      statusLoader?.stop();
      statusLoader = null;
      ensureStatusText();
      const text = activityStatus ? `${connectionStatus} | ${activityStatus}` : connectionStatus;
      statusText?.setText(theme.dim(text));
    }
    lastActivityStatus = activityStatus;
    updateSubheader();
  };

  const setConnectionStatus = (text: string, ttlMs?: number) => {
    connectionStatus = text;
    renderStatus();
    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }
    if (ttlMs && ttlMs > 0) {
      statusTimeout = setTimeout(() => {
        connectionStatus = isConnected ? "connected" : "disconnected";
        renderStatus();
      }, ttlMs);
    }
  };

  const setActivityStatus = (text: string) => {
    activityStatus = text;
    renderStatus();
  };

  const { openOverlay, closeOverlay } = createOverlayHandlers(tui, editor);

  const initialSessionAgentId = (() => {
    if (!initialSessionInput) {
      return null;
    }
    const parsed = parseAgentSessionKey(initialSessionInput);
    return parsed ? normalizeAgentId(parsed.agentId) : null;
  })();

  const sessionActions = createSessionActions({
    client,
    chatLog,
    tui,
    opts,
    state,
    agentNames,
    initialSessionInput,
    initialSessionAgentId,
    resolveSessionKey,
    updateHeader,
    updateSessionBar,
    updateAutocompleteProvider,
    setActivityStatus,
  });
  const { refreshAgents, refreshSessionInfo, loadHistory, setSession, abortActive } =
    sessionActions;

  const { handleChatEvent, handleAgentEvent } = createEventHandlers({
    chatLog,
    tui,
    state,
    setActivityStatus,
    refreshSessionInfo,
  });

  const {
    handleCommand,
    sendMessage,
    openModelSelector,
    openProviderSelector,
    openAgentSelector,
    openSessionSelector,
    openHelpOverlay,
    openCommandPalette,
  } = createCommandHandlers({
    config,
    client,
    chatLog,
    tui,
    opts,
    state,
    deliverDefault,
    openOverlay,
    closeOverlay,
    refreshSessionInfo,
    loadHistory,
    setSession,
    refreshAgents,
    abortActive,
    setActivityStatus,
    formatSessionKey,
    setEditorText: (text: string) => {
      editor.setText(text);
    },
    focusEditor: () => {
      tui.setFocus(editor);
    },
    getWatchlist,
    addWatchSymbol,
    removeWatchSymbol,
    clearWatchlist,
  });

  const { runLocalShellLine } = createLocalShellRunner({
    chatLog,
    tui,
    openOverlay,
    closeOverlay,
  });
  updateAutocompleteProvider();
  editor.onSubmit = createEditorSubmitHandler({
    editor,
    handleCommand,
    sendMessage,
    handleBangLine: runLocalShellLine,
  });

  editor.onEscape = () => {
    void abortActive();
  };
  editor.onCtrlC = () => {
    const now = Date.now();
    if (editor.getText().trim().length > 0) {
      editor.setText("");
      setActivityStatus("cleared input");
      tui.requestRender();
      return;
    }
    if (now - lastCtrlCAt < 1000) {
      client.stop();
      tui.stop();
      process.exit(0);
    }
    lastCtrlCAt = now;
    setActivityStatus("press ctrl+c again to exit");
    tui.requestRender();
  };
  editor.onCtrlD = () => {
    client.stop();
    tui.stop();
    process.exit(0);
  };
  editor.onCtrlO = () => {
    toolsExpanded = !toolsExpanded;
    chatLog.setToolsExpanded(toolsExpanded);
    setActivityStatus(toolsExpanded ? "tools expanded" : "tools collapsed");
    tui.requestRender();
  };
  editor.onCtrlL = () => {
    void openModelSelector();
  };
  editor.onCtrlG = () => {
    void openAgentSelector();
  };
  editor.onCtrlP = () => {
    void openSessionSelector();
  };
  editor.onCtrlT = () => {
    showThinking = !showThinking;
    void loadHistory();
  };
  editor.onShiftTab = () => {
    openHelpOverlay();
  };
  editor.onAltEnter = () => {
    openCommandPalette();
  };

  client.onEvent = (evt) => {
    if (evt.event === "chat") {
      handleChatEvent(evt.payload);
    }
    if (evt.event === "agent") {
      handleAgentEvent(evt.payload);
    }
  };

  client.onConnected = () => {
    isConnected = true;
    const reconnected = wasDisconnected;
    wasDisconnected = false;
    setConnectionStatus("connected");
    void (async () => {
      await refreshAgents();
      updateHeader();
      await loadHistory();
      setConnectionStatus(reconnected ? "gateway reconnected" : "gateway connected", 4000);
      tui.requestRender();
      if (!autoMessageSent && autoMessage) {
        autoMessageSent = true;
        await sendMessage(autoMessage);
      }
      updateSessionBar();
      tui.requestRender();

      // Check if model is set, otherwise prompt for provider
      // Also prompt if the current provider appears unconfigured (placeholder/missing key)
      if (!sessionInfo.model || !checkProviderConfiguredAtStart(sessionInfo.modelProvider)) {
        // Add a small system message to explain why
        if (sessionInfo.model && !checkProviderConfiguredAtStart(sessionInfo.modelProvider)) {
          chatLog.addSystem(`⚠️  Provider '${sessionInfo.modelProvider}' key missing or invalid.`);
        }
        void openProviderSelector();
      }
    })();
  };

  client.onDisconnected = (reason) => {
    isConnected = false;
    wasDisconnected = true;
    historyLoaded = false;
    const reasonLabel = reason?.trim() ? reason.trim() : "closed";
    setConnectionStatus(`gateway disconnected: ${reasonLabel}`, 5000);
    setActivityStatus("idle");
    updateSessionBar();
    tui.requestRender();
  };

  client.onGap = (info) => {
    setConnectionStatus(`event gap: expected ${info.expected}, got ${info.received}`, 5000);
    tui.requestRender();
  };

  updateHeader();
  updateShortcutsBar();
  updateWatchlistBar();
  setConnectionStatus("connecting");
  updateSessionBar();
  tui.start();
  client.start();
}
