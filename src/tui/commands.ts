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

import type { SlashCommand } from "@mariozechner/pi-tui";
import { listChatCommands, listChatCommandsForConfig } from "../auto-reply/commands-registry.js";
import { formatThinkingLevels, listThinkingLevelLabels } from "../auto-reply/thinking.js";
import type { MarketBotConfig } from "../config/types.js";

const VERBOSE_LEVELS = ["on", "off"];
const REASONING_LEVELS = ["on", "off"];
const ELEVATED_LEVELS = ["on", "off", "ask", "full"];
const ACTIVATION_LEVELS = ["mention", "always"];
const USAGE_FOOTER_LEVELS = ["off", "tokens", "full"];

export type ParsedCommand = {
  name: string;
  args: string;
};

export type SlashCommandOptions = {
  cfg?: MarketBotConfig;
  provider?: string;
  model?: string;
};

const COMMAND_ALIASES: Record<string, string> = {
  elev: "elevated",
};

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.replace(/^\//, "").trim();
  if (!trimmed) {
    return { name: "", args: "" };
  }
  const [name, ...rest] = trimmed.split(/\s+/);
  const normalized = name.toLowerCase();
  return {
    name: COMMAND_ALIASES[normalized] ?? normalized,
    args: rest.join(" ").trim(),
  };
}

export function getSlashCommands(options: SlashCommandOptions = {}): SlashCommand[] {
  const thinkLevels = listThinkingLevelLabels(options.provider, options.model);
  const commands: SlashCommand[] = [
    { name: "help", description: "Show slash command help" },
    { name: "status", description: "Show gateway status summary" },
    { name: "dashboard", description: "Open the TUI dashboard" },
    { name: "agent", description: "Switch agent (or open picker)" },
    { name: "agents", description: "Open agent picker" },
    { name: "session", description: "Switch session (or open picker)" },
    { name: "sessions", description: "Open session picker" },
    {
      name: "model",
      description: "Set model (or open picker)",
    },
    { name: "models", description: "Open model picker" },
    {
      name: "think",
      description: "Set thinking level",
      getArgumentCompletions: (prefix) =>
        thinkLevels
          .filter((v) => v.startsWith(prefix.toLowerCase()))
          .map((value) => ({ value, label: value })),
    },
    {
      name: "verbose",
      description: "Set verbose on/off",
      getArgumentCompletions: (prefix) =>
        VERBOSE_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    {
      name: "reasoning",
      description: "Set reasoning on/off",
      getArgumentCompletions: (prefix) =>
        REASONING_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    {
      name: "usage",
      description: "Toggle per-response usage line",
      getArgumentCompletions: (prefix) =>
        USAGE_FOOTER_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    {
      name: "elevated",
      description: "Set elevated on/off/ask/full",
      getArgumentCompletions: (prefix) =>
        ELEVATED_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    {
      name: "elev",
      description: "Alias for /elevated",
      getArgumentCompletions: (prefix) =>
        ELEVATED_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    {
      name: "activation",
      description: "Set group activation",
      getArgumentCompletions: (prefix) =>
        ACTIVATION_LEVELS.filter((v) => v.startsWith(prefix.toLowerCase())).map((value) => ({
          value,
          label: value,
        })),
    },
    { name: "abort", description: "Abort active run" },
    { name: "new", description: "Reset the session" },
    { name: "reset", description: "Reset the session" },
    { name: "settings", description: "Open settings" },
    { name: "exit", description: "Exit the TUI" },
    { name: "quit", description: "Exit the TUI" },
    {
      name: "provider",
      description: "Set provider (or open picker)",
    },
    // Market Analysis Commands
    { name: "analyze", description: "📊 Quick market analysis for a symbol" },
    { name: "watch", description: "👁️ Add symbol to watchlist" },
    { name: "unwatch", description: "🧹 Remove symbol from watchlist" },
    { name: "watchlist", description: "📋 Show current watchlist" },
    { name: "portfolio", description: "💼 Portfolio overview" },
    { name: "news", description: "📰 Recent market news" },
    { name: "alerts", description: "🔔 View price alerts" },
    { name: "technicals", description: "📈 Technical analysis summary" },
    { name: "sentiment", description: "🎯 Market sentiment analysis" },
  ];

  const seen = new Set(commands.map((command) => command.name));
  const gatewayCommands = options.cfg ? listChatCommandsForConfig(options.cfg) : listChatCommands();
  for (const command of gatewayCommands) {
    const aliases = command.textAliases.length > 0 ? command.textAliases : [`/${command.key}`];
    for (const alias of aliases) {
      const name = alias.replace(/^\//, "").trim();
      if (!name || seen.has(name)) {
        continue;
      }
      seen.add(name);
      commands.push({ name, description: command.description });
    }
  }

  return commands;
}

export function helpText(options: SlashCommandOptions = {}): string {
  const thinkLevels = formatThinkingLevels(options.provider, options.model, "|");
  return [
    "━━━ System Commands ━━━",
    "/help              Show this help",
    "/status            Gateway status summary",
    "/dashboard         TUI dashboard",
    "/agent <id>        Switch agent",
    "/session <key>     Switch session",
    "/model <name>      Set model",
    "/provider <name>   Set provider",
    `/think <${thinkLevels}>`,
    "/verbose <on|off>",
    "/reasoning <on|off>",
    "/elevated <on|off|ask|full>",
    "/new or /reset     Reset session",
    "/abort             Abort active run",
    "/settings          Open settings",
    "/exit              Exit TUI",
    "",
    "━━━ Market Analysis ━━━",
    "/analyze <symbol>  Quick analysis (e.g., /analyze NVDA)",
    "/watch <symbol>    Add to watchlist",
    "/unwatch <symbol>  Remove from watchlist",
    "/watchlist         Show watchlist",
    "/portfolio         Portfolio overview",
    "/news              Recent market news",
    "/alerts            Price alerts",
    "/technicals        Technical summary",
    "/sentiment         Sentiment analysis",
  ].join("\\n");
}
