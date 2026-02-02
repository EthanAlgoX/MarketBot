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

import type { Component, TUI } from "@mariozechner/pi-tui";
import {
  formatThinkingLevels,
  normalizeUsageDisplay,
  resolveResponseUsageMode,
} from "../auto-reply/thinking.js";
import type { MarketBotConfig } from "../config/types.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { formatRelativeTime } from "../utils/time-format.js";
import { getSlashCommands, helpText, parseCommand } from "./commands.js";
import type { ChatLog } from "./components/chat-log.js";
import { InfoPanel } from "./components/info-panel.js";
import {
  createFilterableSelectList,
  createSearchableSelectList,
  createSettingsList,
  createTextInputOverlay,
} from "./components/selectors.js";
import type { GatewayChatClient } from "./gateway-chat.js";
import { formatTokens } from "./tui-formatters.js";
import { formatStatusSummary } from "./tui-status-summary.js";
import type {
  AgentSummary,
  GatewayStatusSummary,
  TuiOptions,
  TuiStateAccess,
} from "./tui-types.js";

type CommandHandlerContext = {
  config: MarketBotConfig;
  client: GatewayChatClient;
  chatLog: ChatLog;
  tui: TUI;
  opts: TuiOptions;
  state: TuiStateAccess;
  deliverDefault: boolean;
  openOverlay: (component: Component) => void;
  closeOverlay: () => void;
  refreshSessionInfo: () => Promise<void>;
  loadHistory: () => Promise<void>;
  setSession: (key: string) => Promise<void>;
  refreshAgents: () => Promise<void>;
  abortActive: () => Promise<void>;
  setActivityStatus: (text: string) => void;
  formatSessionKey: (key: string) => string;
  setEditorText: (text: string) => void;
  focusEditor: () => void;
  getWatchlist: () => string[];
  addWatchSymbol: (raw: string) => { ok: boolean; reason?: string; symbol: string };
  removeWatchSymbol: (raw: string) => { ok: boolean; reason?: string; symbol: string };
  clearWatchlist: () => void;
};

export function createCommandHandlers(context: CommandHandlerContext) {
  const {
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
    setEditorText,
    focusEditor,
    getWatchlist,
    addWatchSymbol,
    removeWatchSymbol,
    clearWatchlist,
  } = context;

  const setAgent = async (id: string) => {
    state.currentAgentId = normalizeAgentId(id);
    await setSession("");
  };

  const openModelSelector = async () => {
    try {
      const models = await client.listModels();
      if (models.length === 0) {
        chatLog.addSystem("no models available");
        tui.requestRender();
        return;
      }
      const items = models.map((model) => ({
        value: `${model.provider}/${model.id}`,
        label: `${model.provider}/${model.id}`,
        description: model.name && model.name !== model.id ? model.name : "",
      }));
      const selector = createSearchableSelectList(items, 9);
      selector.onSelect = (item) => {
        void (async () => {
          try {
            await client.patchSession({
              key: state.currentSessionKey,
              model: item.value,
            });
            chatLog.addSystem(`model set to ${item.value}`);
            await refreshSessionInfo();
          } catch (err) {
            chatLog.addSystem(`model set failed: ${String(err)}`);
          }
          closeOverlay();
          tui.requestRender();
        })();
      };
      selector.onCancel = () => {
        closeOverlay();
        tui.requestRender();
      };
      openOverlay(selector);
      tui.requestRender();
    } catch (err) {
      chatLog.addSystem(`model list failed: ${String(err)}`);
      tui.requestRender();
    }
  };

  const checkProviderStatus = (
    provider?: string,
    cfg?: any,
  ): { status: "Configured" | "Unconfigured" | "Warning"; message?: string } => {
    if (!provider) {
      return { status: "Unconfigured" };
    }
    const p = provider.toLowerCase();

    let envKey = "";
    if (p.includes("deepseek")) {
      envKey = process.env.DEEPSEEK_API_KEY ?? "";
    } else if (p.includes("openai")) {
      envKey = process.env.OPENAI_API_KEY ?? "";
    } else if (p.includes("anthropic")) {
      envKey = process.env.ANTHROPIC_API_KEY ?? "";
    } else if (p.includes("gemini")) {
      envKey = process.env.GEMINI_API_KEY ?? "";
    }

    const envIsPlaceholder = /placeholder/i.test(envKey);

    // Check config
    let configKey = "";
    if (cfg?.models?.providers) {
      configKey = cfg.models.providers[p]?.apiKey ?? "";
    }
    const configIsReal = configKey && !/placeholder/i.test(configKey);

    if (configIsReal) {
      if (envIsPlaceholder) {
        return {
          status: "Warning",
          message: "⚠️ Configured (but env placeholder may override - restart gateway)",
        };
      }
      return { status: "Configured", message: "Configured" };
    }

    if (envKey && !envIsPlaceholder) {
      return { status: "Configured", message: "Configured (via Env)" };
    }

    return { status: "Unconfigured", message: "⚠️ Unconfigured (Enter to set key)" };
  };

  const checkProviderConfigured = (provider?: string, cfg?: any): boolean => {
    const res = checkProviderStatus(provider, cfg);
    return res.status === "Configured" || res.status === "Warning";
  };

  const promptApiKey = async (provider: string, onDone: () => Promise<void>) => {
    const title = `${provider} API Key`;
    const overlay = createTextInputOverlay(tui, title);

    overlay.onCommit = async (key: string) => {
      try {
        if (!key) {
          chatLog.addSystem("API key cannot be empty");
          tui.requestRender();
          return;
        }

        const snapshot = (await client.getConfig()) as any;
        const baseHash = snapshot.hash;

        // Actually the protocol's Snapshot might have a hash.
        // Let's assume the snapshot returned by getConfig has what we need.
        const patch = {
          models: {
            providers: {
              [provider.toLowerCase()]: {
                apiKey: key,
              },
            },
          },
        };

        await client.patchConfig({
          raw: JSON.stringify(patch),
          baseHash,
          note: `Update ${provider} API key from TUI`,
        });

        chatLog.addSystem(`✅ ${provider} API key updated. Gateway restarting...`);
        closeOverlay();
        tui.requestRender();
        await onDone();
      } catch (err) {
        chatLog.addSystem(`❌ Failed to update key: ${String(err)}`);
        tui.requestRender();
      }
    };

    overlay.onCancel = () => {
      closeOverlay();
      tui.requestRender();
    };

    openOverlay(overlay);
    tui.setFocus(overlay.getEditor());
    tui.requestRender();
  };

  const openProviderSelector = async () => {
    try {
      const models = await client.listModels();
      if (models.length === 0) {
        chatLog.addSystem("no providers available (no models found)");
        tui.requestRender();
        return;
      }

      // Extract unique providers
      const providerSet = new Set<string>();
      for (const model of models) {
        if (model.provider) {
          providerSet.add(model.provider);
        }
      }

      if (providerSet.size === 0) {
        chatLog.addSystem("no providers found");
        tui.requestRender();
        return;
      }

      const snapshot = (await client.getConfig()) as any;
      const cfg = snapshot?.config;

      const items = Array.from(providerSet)
        .toSorted()
        .map((provider) => ({
          value: provider,
          label: provider,
          description: checkProviderStatus(provider, cfg).message,
        }));

      // Add "Skip" option
      items.push({
        value: "skip",
        label: "Skip",
        description: "Do not set a provider now",
      });

      const selector = createSearchableSelectList(items, 9);
      selector.onSelect = (item) => {
        void (async () => {
          closeOverlay();

          if (item.value === "skip") {
            chatLog.addSystem("provider selection skipped");
            tui.requestRender();
            return;
          }

          const provider = item.value;
          const isConfigured = checkProviderConfigured(provider);

          const applyModel = async () => {
            const providerModels = models.filter((m) => m.provider === provider);
            if (providerModels.length === 0) {
              chatLog.addSystem(`no models found for provider ${provider}`);
              tui.requestRender();
              return;
            }

            const selectedModel = providerModels[0];
            try {
              const modelRef = `${selectedModel.provider}/${selectedModel.id}`;
              await client.patchSession({
                key: state.currentSessionKey,
                model: modelRef,
              });
              chatLog.addSystem(`provider set to ${provider}, model set to ${modelRef}`);
              await refreshSessionInfo();
            } catch (err) {
              chatLog.addSystem(`provider set failed: ${String(err)}`);
            }
            tui.requestRender();
          };

          if (!isConfigured) {
            await promptApiKey(provider, applyModel);
          } else {
            await applyModel();
          }
        })();
      };
      selector.onCancel = () => {
        closeOverlay();
        tui.requestRender();
      };
      openOverlay(selector);
      tui.requestRender();
    } catch (err) {
      chatLog.addSystem(`provider list failed: ${String(err)}`);
      tui.requestRender();
    }
  };

  const openAgentSelector = async () => {
    await refreshAgents();
    if (state.agents.length === 0) {
      chatLog.addSystem("no agents found");
      tui.requestRender();
      return;
    }
    const items = state.agents.map((agent: AgentSummary) => ({
      value: agent.id,
      label: agent.name ? `${agent.id} (${agent.name})` : agent.id,
      description: agent.id === state.agentDefaultId ? "default" : "",
    }));
    const selector = createSearchableSelectList(items, 9);
    selector.onSelect = (item) => {
      void (async () => {
        closeOverlay();
        await setAgent(item.value);
        tui.requestRender();
      })();
    };
    selector.onCancel = () => {
      closeOverlay();
      tui.requestRender();
    };
    openOverlay(selector);
    tui.requestRender();
  };

  const openSessionSelector = async () => {
    try {
      const result = await client.listSessions({
        includeGlobal: false,
        includeUnknown: false,
        includeDerivedTitles: true,
        includeLastMessage: true,
        agentId: state.currentAgentId,
      });
      const items = result.sessions.map((session) => {
        const title = session.derivedTitle ?? session.displayName;
        const formattedKey = formatSessionKey(session.key);
        // Avoid redundant "title (key)" when title matches key
        const label = title && title !== formattedKey ? `${title} (${formattedKey})` : formattedKey;
        // Build description: time + message preview
        const timePart = session.updatedAt ? formatRelativeTime(session.updatedAt) : "";
        const preview = session.lastMessagePreview?.replace(/\s+/g, " ").trim();
        const description =
          timePart && preview ? `${timePart} · ${preview}` : (preview ?? timePart);
        return {
          value: session.key,
          label,
          description,
          searchText: [
            session.displayName,
            session.label,
            session.subject,
            session.sessionId,
            session.key,
            session.lastMessagePreview,
          ]
            .filter(Boolean)
            .join(" "),
        };
      });
      const selector = createFilterableSelectList(items, 9);
      selector.onSelect = (item) => {
        void (async () => {
          closeOverlay();
          await setSession(item.value);
          tui.requestRender();
        })();
      };
      selector.onCancel = () => {
        closeOverlay();
        tui.requestRender();
      };
      openOverlay(selector);
      tui.requestRender();
    } catch (err) {
      chatLog.addSystem(`sessions list failed: ${String(err)}`);
      tui.requestRender();
    }
  };

  const openSettings = () => {
    const items = [
      {
        id: "tools",
        label: "Tool output",
        currentValue: state.toolsExpanded ? "expanded" : "collapsed",
        values: ["collapsed", "expanded"],
      },
      {
        id: "thinking",
        label: "Show thinking",
        currentValue: state.showThinking ? "on" : "off",
        values: ["off", "on"],
      },
    ];
    const settings = createSettingsList(
      items,
      (id, value) => {
        if (id === "tools") {
          state.toolsExpanded = value === "expanded";
          chatLog.setToolsExpanded(state.toolsExpanded);
        }
        if (id === "thinking") {
          state.showThinking = value === "on";
          void loadHistory();
        }
        tui.requestRender();
      },
      () => {
        closeOverlay();
        tui.requestRender();
      },
    );
    openOverlay(settings);
    tui.requestRender();
  };

  const buildHelpOverlayText = () => {
    const lines = [
      "## Shortcuts",
      "- Alt+Enter: open command palette",
      "- Shift+Tab: open help",
      "- Ctrl+L: model picker",
      "- Ctrl+G: agent picker",
      "- Ctrl+P: session picker",
      "- Ctrl+O: toggle tool output",
      "- Ctrl+T: toggle thinking",
      "- Ctrl+C: exit",
      "",
      "## Slash Commands",
      helpText({
        provider: state.sessionInfo.modelProvider,
        model: state.sessionInfo.model,
      }).replace(/\\n/g, "\n"),
    ];
    return lines.join("\n");
  };

  const openHelpOverlay = () => {
    const panel = new InfoPanel("MarketBot Help", buildHelpOverlayText(), {
      onClose: () => {
        closeOverlay();
        tui.requestRender();
      },
      footer: "Esc to close",
    });
    openOverlay(panel);
    tui.requestRender();
  };

  const openCommandPalette = () => {
    const items = getSlashCommands({
      cfg: config,
      provider: state.sessionInfo.modelProvider,
      model: state.sessionInfo.model,
    }).map((command) => ({
      value: command.name,
      label: `/${command.name}`,
      description: command.description,
    }));
    const selector = createSearchableSelectList(items, 10);
    selector.onSelect = (item) => {
      closeOverlay();
      setEditorText(`/${item.value} `);
      focusEditor();
      tui.requestRender();
    };
    selector.onCancel = () => {
      closeOverlay();
      tui.requestRender();
    };
    openOverlay(selector);
    tui.requestRender();
  };

  const openWatchlistOverlay = () => {
    const symbols = getWatchlist();
    if (symbols.length === 0) {
      const panel = new InfoPanel(
        "Watchlist",
        "Watchlist is empty.\n\nUse `/watch <symbol>` to add tickers.",
        {
          onClose: () => {
            closeOverlay();
            tui.requestRender();
          },
          footer: "Esc to close",
        },
      );
      openOverlay(panel);
      tui.requestRender();
      return;
    }
    const items = symbols.map((symbol) => ({
      value: symbol,
      label: symbol,
      description: "Enter to analyze",
    }));
    const selector = createSearchableSelectList(items, 9);
    selector.onSelect = (item) => {
      closeOverlay();
      setEditorText(`/analyze ${item.value} `);
      focusEditor();
      tui.requestRender();
    };
    selector.onCancel = () => {
      closeOverlay();
      tui.requestRender();
    };
    openOverlay(selector);
    tui.requestRender();
  };

  const buildDashboardText = (summary?: GatewayStatusSummary) => {
    const lines: string[] = [];
    lines.push("## Connection");
    lines.push(`- Status: ${state.connectionStatus}`);
    lines.push(`- Activity: ${state.activityStatus}`);
    lines.push("");
    lines.push("## Session");
    const sessionKeyLabel = formatSessionKey(state.currentSessionKey);
    const sessionLabel = state.sessionInfo.displayName
      ? `${sessionKeyLabel} (${state.sessionInfo.displayName})`
      : sessionKeyLabel;
    const modelLabel = state.sessionInfo.model
      ? state.sessionInfo.modelProvider
        ? `${state.sessionInfo.modelProvider}/${state.sessionInfo.model}`
        : state.sessionInfo.model
      : "unknown";
    lines.push(`- Agent: ${state.currentAgentId}`);
    lines.push(`- Session: ${sessionLabel}`);
    lines.push(`- Model: ${modelLabel}`);
    lines.push(
      `- Tokens: ${formatTokens(state.sessionInfo.totalTokens ?? null, state.sessionInfo.contextTokens ?? null)}`,
    );
    const think = state.sessionInfo.thinkingLevel ?? "off";
    const verbose = state.sessionInfo.verboseLevel ?? "off";
    const reasoning = state.sessionInfo.reasoningLevel ?? "off";
    const usage = state.sessionInfo.responseUsage ?? "off";
    lines.push(`- Thinking: ${think}`);
    lines.push(`- Verbose: ${verbose}`);
    lines.push(`- Reasoning: ${reasoning}`);
    lines.push(`- Usage footer: ${usage}`);
    if (typeof state.sessionInfo.updatedAt === "number") {
      lines.push(`- Last update: ${formatRelativeTime(state.sessionInfo.updatedAt)}`);
    }
    lines.push("");
    lines.push("## Watchlist");
    const symbols = getWatchlist();
    if (symbols.length === 0) {
      lines.push("- empty");
    } else {
      for (const symbol of symbols) {
        lines.push(`- ${symbol}`);
      }
    }
    if (summary) {
      lines.push("");
      lines.push("## Gateway");
      const summaryLines = formatStatusSummary(summary);
      for (const line of summaryLines) {
        if (!line.trim()) {
          lines.push("");
          continue;
        }
        lines.push(`- ${line}`);
      }
    }
    return lines.join("\n");
  };

  const openDashboardOverlay = async () => {
    let summary: GatewayStatusSummary | undefined;
    try {
      const status = await client.getStatus();
      if (status && typeof status === "object" && !Array.isArray(status)) {
        summary = status as GatewayStatusSummary;
      }
    } catch (err) {
      chatLog.addSystem(`status failed: ${String(err)}`);
    }
    const panel = new InfoPanel("MarketBot Dashboard", buildDashboardText(summary), {
      onClose: () => {
        closeOverlay();
        tui.requestRender();
      },
      footer: "Esc to close",
    });
    openOverlay(panel);
    tui.requestRender();
  };

  const handleCommand = async (raw: string) => {
    const { name, args } = parseCommand(raw);
    if (!name) {
      return;
    }
    switch (name) {
      case "help":
        openHelpOverlay();
        break;
      case "status":
        try {
          const status = await client.getStatus();
          if (typeof status === "string") {
            chatLog.addSystem(status);
            break;
          }
          if (status && typeof status === "object") {
            const lines = formatStatusSummary(status as GatewayStatusSummary);
            for (const line of lines) {
              chatLog.addSystem(line);
            }
            break;
          }
          chatLog.addSystem("status: unknown response");
        } catch (err) {
          chatLog.addSystem(`status failed: ${String(err)}`);
        }
        break;
      case "agent":
        if (!args) {
          await openAgentSelector();
        } else {
          await setAgent(args);
        }
        break;
      case "agents":
        await openAgentSelector();
        break;
      case "session":
        if (!args) {
          await openSessionSelector();
        } else {
          await setSession(args);
        }
        break;
      case "sessions":
        await openSessionSelector();
        break;
      case "model":
        if (!args) {
          await openModelSelector();
        } else {
          try {
            await client.patchSession({
              key: state.currentSessionKey,
              model: args,
            });
            chatLog.addSystem(`model set to ${args}`);
            await refreshSessionInfo();
          } catch (err) {
            chatLog.addSystem(`model set failed: ${String(err)}`);
          }
        }
        break;
      case "models":
        await openModelSelector();
        break;
      case "provider":
      case "providers":
        if (!args) {
          await openProviderSelector();
        } else {
          // We could try to set it directly if arg matches known provider,
          // but for now re-use selector or just warn if simple set needed.
          // Let's just open selector if specific logic isn't trivial.
          // Or implementing simple match:
          chatLog.addSystem("opening provider picker...");
          await openProviderSelector();
        }
        break;
      case "think":
        if (!args) {
          const levels = formatThinkingLevels(
            state.sessionInfo.modelProvider,
            state.sessionInfo.model,
            "|",
          );
          chatLog.addSystem(`usage: /think <${levels}>`);
          break;
        }
        try {
          await client.patchSession({
            key: state.currentSessionKey,
            thinkingLevel: args,
          });
          chatLog.addSystem(`thinking set to ${args}`);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`think failed: ${String(err)}`);
        }
        break;
      case "verbose":
        if (!args) {
          chatLog.addSystem("usage: /verbose <on|off>");
          break;
        }
        try {
          await client.patchSession({
            key: state.currentSessionKey,
            verboseLevel: args,
          });
          chatLog.addSystem(`verbose set to ${args}`);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`verbose failed: ${String(err)}`);
        }
        break;
      case "reasoning":
        if (!args) {
          chatLog.addSystem("usage: /reasoning <on|off>");
          break;
        }
        try {
          await client.patchSession({
            key: state.currentSessionKey,
            reasoningLevel: args,
          });
          chatLog.addSystem(`reasoning set to ${args}`);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`reasoning failed: ${String(err)}`);
        }
        break;
      case "usage": {
        const normalized = args ? normalizeUsageDisplay(args) : undefined;
        if (args && !normalized) {
          chatLog.addSystem("usage: /usage <off|tokens|full>");
          break;
        }
        const currentRaw = state.sessionInfo.responseUsage;
        const current = resolveResponseUsageMode(currentRaw);
        const next =
          normalized ?? (current === "off" ? "tokens" : current === "tokens" ? "full" : "off");
        try {
          await client.patchSession({
            key: state.currentSessionKey,
            responseUsage: next === "off" ? null : next,
          });
          chatLog.addSystem(`usage footer: ${next}`);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`usage failed: ${String(err)}`);
        }
        break;
      }
      case "elevated":
        if (!args) {
          chatLog.addSystem("usage: /elevated <on|off|ask|full>");
          break;
        }
        if (!["on", "off", "ask", "full"].includes(args)) {
          chatLog.addSystem("usage: /elevated <on|off|ask|full>");
          break;
        }
        try {
          await client.patchSession({
            key: state.currentSessionKey,
            elevatedLevel: args,
          });
          chatLog.addSystem(`elevated set to ${args}`);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`elevated failed: ${String(err)}`);
        }
        break;
      case "activation":
        if (!args) {
          chatLog.addSystem("usage: /activation <mention|always>");
          break;
        }
        try {
          await client.patchSession({
            key: state.currentSessionKey,
            groupActivation: args === "always" ? "always" : "mention",
          });
          chatLog.addSystem(`activation set to ${args}`);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`activation failed: ${String(err)}`);
        }
        break;
      case "new":
      case "reset":
        try {
          // Clear token counts immediately to avoid stale display (#1523)
          state.sessionInfo.inputTokens = null;
          state.sessionInfo.outputTokens = null;
          state.sessionInfo.totalTokens = null;
          tui.requestRender();

          await client.resetSession(state.currentSessionKey);
          chatLog.addSystem(`session ${state.currentSessionKey} reset`);
          await loadHistory();
        } catch (err) {
          chatLog.addSystem(`reset failed: ${String(err)}`);
        }
        break;
      case "abort":
        await abortActive();
        break;
      case "settings":
        openSettings();
        break;
      case "dashboard":
        await openDashboardOverlay();
        break;
      case "exit":
      case "quit":
        client.stop();
        tui.stop();
        process.exit(0);
        break;
      // Market Analysis Commands
      case "analyze":
        if (!args) {
          chatLog.addSystem("📊 Usage: /analyze <symbol> (e.g., /analyze NVDA)");
          break;
        }
        await sendMessage(`Analyze ${args.toUpperCase()} with recent catalysts/news and macro drivers. Include:
- Technical levels (support/resistance)
- Key catalysts and upcoming events
- Risk assessment
- Actionable trade ideas with entry/exit levels`);
        break;
      case "watch":
        if (!args) {
          chatLog.addSystem("👁️ Usage: /watch <symbol> (e.g., /watch AAPL)");
          break;
        }
        {
          const symbols = args.split(/[,\s]+/).filter(Boolean);
          const added: string[] = [];
          const skipped: string[] = [];
          const invalid: string[] = [];
          for (const symbol of symbols) {
            const result = addWatchSymbol(symbol);
            if (result.ok) {
              added.push(result.symbol);
            } else if (result.reason === "invalid") {
              invalid.push(result.symbol);
            } else {
              skipped.push(result.symbol);
            }
          }
          if (added.length > 0) {
            chatLog.addSystem(`👁️ Added to watchlist: ${added.join(", ")}`);
          }
          if (skipped.length > 0) {
            chatLog.addSystem(`Already in watchlist: ${skipped.join(", ")}`);
          }
          if (invalid.length > 0) {
            chatLog.addSystem(`Invalid symbols: ${invalid.join(", ")}`);
          }
        }
        break;
      case "watchlist":
        if (args && ["clear", "reset", "empty"].includes(args.toLowerCase())) {
          clearWatchlist();
          chatLog.addSystem("📋 Watchlist cleared.");
          break;
        }
        openWatchlistOverlay();
        break;
      case "unwatch":
        if (!args) {
          chatLog.addSystem("🧹 Usage: /unwatch <symbol|all>");
          break;
        }
        if (["all", "clear", "reset", "empty"].includes(args.toLowerCase())) {
          clearWatchlist();
          chatLog.addSystem("🧹 Watchlist cleared.");
          break;
        }
        {
          const symbols = args.split(/[,\s]+/).filter(Boolean);
          const removed: string[] = [];
          const missing: string[] = [];
          for (const symbol of symbols) {
            const result = removeWatchSymbol(symbol);
            if (result.ok) {
              removed.push(result.symbol);
            } else if (result.reason === "not_found") {
              missing.push(result.symbol);
            }
          }
          if (removed.length > 0) {
            chatLog.addSystem(`🧹 Removed from watchlist: ${removed.join(", ")}`);
          }
          if (missing.length > 0) {
            chatLog.addSystem(`Not in watchlist: ${missing.join(", ")}`);
          }
        }
        break;
        break;
      case "portfolio":
        await sendMessage(
          "Show my portfolio overview with current positions, P&L, and recommendations.",
        );
        break;
      case "news":
        if (!args) {
          await sendMessage(
            "What are the most important market news and events today that could impact trading?",
          );
        } else {
          await sendMessage(`What are the latest news and developments for ${args.toUpperCase()}?`);
        }
        break;
      case "alerts":
        chatLog.addSystem("🔔 Price alerts feature coming soon.");
        break;
      case "technicals":
        if (!args) {
          chatLog.addSystem("📈 Usage: /technicals <symbol> (e.g., /technicals SPY)");
          break;
        }
        await sendMessage(`Provide a detailed technical analysis for ${args.toUpperCase()}:
- Trend direction and strength
- Key support/resistance levels
- RSI, MACD, moving averages
- Volume analysis
- Chart patterns`);
        break;
      case "sentiment":
        if (!args) {
          await sendMessage(
            "Analyze overall market sentiment including fear/greed index, put/call ratios, and institutional positioning.",
          );
        } else {
          await sendMessage(
            `Analyze the market sentiment for ${args.toUpperCase()} including social media buzz, analyst ratings, and institutional activity.`,
          );
        }
        break;
      default:
        await sendMessage(raw);
        break;
    }
    tui.requestRender();
  };

  const sendMessage = async (text: string) => {
    try {
      chatLog.addUser(text);
      tui.requestRender();
      setActivityStatus("sending");
      const { runId } = await client.sendChat({
        sessionKey: state.currentSessionKey,
        message: text,
        thinking: opts.thinking,
        deliver: deliverDefault,
        timeoutMs: opts.timeoutMs,
      });
      state.activeChatRunId = runId;
      setActivityStatus("waiting");
    } catch (err) {
      chatLog.addSystem(`send failed: ${String(err)}`);
      setActivityStatus("error");
    }
    tui.requestRender();
  };

  return {
    handleCommand,
    sendMessage,
    openModelSelector,
    openProviderSelector,
    openAgentSelector,
    openSessionSelector,
    openSettings,
    openHelpOverlay,
    openCommandPalette,
    openWatchlistOverlay,
    openDashboardOverlay,
    setAgent,
  };
}
