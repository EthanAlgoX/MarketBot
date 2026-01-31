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

import type { Command } from "commander";
import { agentCliCommand } from "../../commands/agent-via-gateway.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { createDefaultDeps } from "../deps.js";
import { formatHelpExamples } from "../help-format.js";

const ANALYSIS_SYSTEM_PROMPT = [
  "You are MarketBot, a market and trading analysis assistant.",
  "Prioritize accuracy, cite assumptions, and separate facts from hypotheses.",
  "Return concise, structured analysis with clear risk/invalidation levels.",
  "If live data is missing, state the limitation and suggest what to check next.",
].join("\n");

type AnalyzeOptions = {
  asset?: string;
  market?: string;
  timeframe?: string;
  risk?: string;
  style?: string;
  news?: boolean;
  message?: string;
  to?: string;
  sessionId?: string;
  agent?: string;
  channel?: string;
  replyTo?: string;
  replyChannel?: string;
  replyAccount?: string;
  thinking?: string;
  verbose?: string;
  local?: boolean;
  deliver?: boolean;
  json?: boolean;
  timeout?: string;
};

function buildAnalysisMessage(opts: AnalyzeOptions): string {
  const base = opts.message?.trim();
  if (base) {
    return base;
  }

  if (!opts.asset) {
    throw new Error("Provide --asset or --message to describe the analysis target.");
  }

  const parts: string[] = [];
  const headline = [`Analyze ${opts.asset}`];
  if (opts.market) {
    headline.push(`(${opts.market})`);
  }
  parts.push(headline.join(" "));

  const context: string[] = [];
  if (opts.timeframe) {
    context.push(`Timeframe: ${opts.timeframe}`);
  }
  if (opts.risk) {
    context.push(`Risk profile: ${opts.risk}`);
  }
  if (opts.style) {
    context.push(`Style focus: ${opts.style}`);
  }
  if (opts.news) {
    context.push("Include recent catalysts/news and macro drivers.");
  }

  if (context.length > 0) {
    parts.push(`\nContext:\n- ${context.join("\n- ")}`);
  }

  return parts.join("\n");
}

export function registerAnalyzeCommand(program: Command) {
  program
    .command("analyze")
    .description("Generate a structured market analysis for a given asset")
    .option("--asset <symbol>", "Primary asset/symbol (BTC, NVDA, EURUSD, XAUUSD)")
    .option("--market <type>", "Market: crypto | equities | forex | rates | commodities")
    .option("--timeframe <tf>", "Timeframe (1h, 4h, 1d, 1w)")
    .option("--risk <level>", "Risk profile: low | medium | high")
    .option("--style <style>", "Style focus: technical | fundamental | macro | sentiment")
    .option("--news", "Include recent catalysts/news context", false)
    .option("-m, --message <text>", "Custom analysis request (overrides flags)")
    .option("-t, --to <number>", "Recipient number in E.164 used to derive the session key")
    .option("--session-id <id>", "Use an explicit session id")
    .option("--agent <id>", "Agent id (overrides routing bindings)")
    .option("--thinking <level>", "Thinking level: off | minimal | low | medium | high")
    .option("--verbose <on|off>", "Persist agent verbose level for the session")
    .option("--channel <channel>", "Delivery channel override")
    .option("--reply-to <target>", "Delivery target override (separate from routing)")
    .option("--reply-channel <channel>", "Delivery channel override (separate from routing)")
    .option("--reply-account <id>", "Delivery account id override")
    .option(
      "--local",
      "Run the embedded agent locally (requires model provider API keys in your shell)",
      false,
    )
    .option("--deliver", "Send the agent's reply back to the selected channel", false)
    .option("--json", "Output result as JSON", false)
    .option(
      "--timeout <seconds>",
      "Override agent command timeout (seconds, default 600 or config value)",
    )
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("Examples:")}
${formatHelpExamples([
  ["marketbot analyze --asset BTC --timeframe 1h", "Quick crypto analysis."],
  [
    "marketbot analyze --asset NVDA --market equities --style fundamental --news",
    "Include catalysts + fundamentals.",
  ],
  [
    'marketbot analyze --message "Assess EURUSD with FOMC risk and key levels"',
    "Custom prompt overrides flags.",
  ],
  ["marketbot analyze --asset XAUUSD --risk low --json", "JSON output for downstream tools."],
])}

${theme.muted("Docs:")} ${formatDocsLink("/cli/analyze", "docs.marketbot.ai/cli/analyze")}`,
    )
    .action(async (opts) => {
      const message = buildAnalysisMessage(opts);
      const hasSessionTarget = Boolean(opts.to || opts.sessionId || opts.agent);
      const agent = hasSessionTarget ? opts.agent : "main";
      const deps = createDefaultDeps();
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentCliCommand(
          {
            message,
            agent,
            to: opts.to,
            sessionId: opts.sessionId,
            thinking: opts.thinking,
            verbose: opts.verbose,
            json: opts.json,
            timeout: opts.timeout,
            deliver: opts.deliver,
            channel: opts.channel,
            replyTo: opts.replyTo,
            replyChannel: opts.replyChannel,
            replyAccount: opts.replyAccount,
            extraSystemPrompt: ANALYSIS_SYSTEM_PROMPT,
            local: opts.local,
          },
          defaultRuntime,
          deps,
        );
      });
    });
}
