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
  ProcessTerminal,
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
import { getSlashCommands } from "./commands.js";
import { ChatLog } from "./components/chat-log.js";
import { CustomEditor } from "./components/custom-editor.js";
import { StatusBar } from "./components/status-bar.js";
import { GatewayChatClient } from "./gateway-chat.js";
import { StatusManager } from "./status-manager.js";
import { editorTheme } from "./theme/theme.js";
import { createCommandHandlers } from "./tui-command-handlers.js";
import { createEventHandlers } from "./tui-event-handlers.js";
import { createLocalShellRunner } from "./tui-local-shell.js";
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
    if (!provider) {
      return false;
    }
    const p = provider.toLowerCase();

    // Check initial config first
    if (config.models?.providers) {
      const provCfg = config.models.providers[p] as any;
      if (provCfg?.apiKey && !provCfg.apiKey.includes("placeholder")) {
        return true;
      }
    }

    let key = "";
    if (p.includes("deepseek")) {
      key = process.env.DEEPSEEK_API_KEY ?? "";
    } else if (p.includes("openai")) {
      key = process.env.OPENAI_API_KEY ?? "";
    } else if (p.includes("anthropic")) {
      key = process.env.ANTHROPIC_API_KEY ?? "";
    } else if (p.includes("gemini")) {
      key = process.env.GEMINI_API_KEY ?? "";
    } else {
      return true;
    }

    if (!key || /placeholder/i.test(key) || key === "") {
      return false;
    }
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

  const statusManager = new StatusManager();

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
      statusManager.setIsConnected(value);
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
      return statusManager.connectionStatus;
    },
    set connectionStatus(value) {
      statusManager.setConnectionStatus(value);
    },
    get activityStatus() {
      return statusManager.activityStatus;
    },
    set activityStatus(value) {
      statusManager.setActivityStatus(value);
    },
    get statusTimeout() {
      return null; // Not exposed directly anymore, managed by statusManager
    },
    set statusTimeout(value) {
      // no-op
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
  const statusBar = new StatusBar(tui, statusManager);
  const chatLog = new ChatLog();
  const editor = new CustomEditor(tui, editorTheme);
  const root = new Container();

  root.addChild(statusBar);
  root.addChild(chatLog);
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

  const updateHeader = () => {
    statusBar.updateHeader(client.connection.url);
  };

  const updateSessionBar = () => {
    statusBar.updateSessionBar(
      sessionInfo,
      currentSessionKey,
      currentAgentId,
      formatSessionKey,
      formatAgentLabel,
    );
  };

  const normalizeSymbol = (raw: string) => raw.trim().toUpperCase();
  const isValidSymbol = (symbol: string) => /^[A-Z0-9.-]{1,12}$/.test(symbol);

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
    statusBar.updateWatchlistBar(watchlist);
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
    statusBar.updateWatchlistBar(watchlist);
    return { ok: true, symbol };
  };

  const getWatchlist = () => [...watchlist];

  const clearWatchlist = () => {
    watchlist.splice(0, watchlist.length);
    statusBar.updateWatchlistBar(watchlist);
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
    setActivityStatus: (text) => statusManager.setActivityStatus(text),
  });
  const { refreshAgents, refreshSessionInfo, loadHistory, setSession, abortActive } =
    sessionActions;

  const { handleChatEvent, handleAgentEvent } = createEventHandlers({
    chatLog,
    tui,
    state,
    setActivityStatus: (text) => statusManager.setActivityStatus(text),
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
    setActivityStatus: (text) => statusManager.setActivityStatus(text),
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
      statusManager.setActivityStatus("cleared input");
      tui.requestRender();
      return;
    }
    if (now - lastCtrlCAt < 1000) {
      client.stop();
      tui.stop();
      process.exit(0);
    }
    lastCtrlCAt = now;
    statusManager.setActivityStatus("press ctrl+c again to exit");
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
    statusManager.setActivityStatus(toolsExpanded ? "tools expanded" : "tools collapsed");
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
    statusManager.setIsConnected(true);
    const reconnected = wasDisconnected;
    wasDisconnected = false;
    statusManager.setConnectionStatus("connected");
    void (async () => {
      await refreshAgents();
      updateHeader();
      await loadHistory();
      statusManager.setConnectionStatus(
        reconnected ? "gateway reconnected" : "gateway connected",
        4000,
      );
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
    statusManager.setIsConnected(false);
    wasDisconnected = true;
    historyLoaded = false;
    const reasonLabel = reason?.trim() ? reason.trim() : "closed";
    statusManager.setConnectionStatus(`gateway disconnected: ${reasonLabel}`, 5000);
    statusManager.setActivityStatus("idle");
    updateSessionBar();
    tui.requestRender();
  };

  client.onGap = (info) => {
    statusManager.setConnectionStatus(
      `event gap: expected ${info.expected}, got ${info.received}`,
      5000,
    );
    tui.requestRender();
  };

  updateHeader();
  statusBar.updateShortcutsBar();
  statusBar.updateWatchlistBar(watchlist);
  statusManager.setConnectionStatus("connecting");
  updateSessionBar();
  tui.start();
  client.start();
}
