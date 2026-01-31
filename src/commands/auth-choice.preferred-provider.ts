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

import type { AuthChoice } from "./onboard-types.js";

const PREFERRED_PROVIDER_BY_AUTH_CHOICE: Partial<Record<AuthChoice, string>> = {
  oauth: "anthropic",
  "setup-token": "anthropic",
  "claude-cli": "anthropic",
  token: "anthropic",
  apiKey: "anthropic",
  "openai-codex": "openai-codex",
  "codex-cli": "openai-codex",
  chutes: "chutes",
  "openai-api-key": "openai",
  "openrouter-api-key": "openrouter",
  "ai-gateway-api-key": "vercel-ai-gateway",
  "moonshot-api-key": "moonshot",
  "kimi-code-api-key": "kimi-coding",
  "gemini-api-key": "google",
  "google-antigravity": "google-antigravity",
  "google-gemini-cli": "google-gemini-cli",
  "zai-api-key": "zai",
  "xiaomi-api-key": "xiaomi",
  "synthetic-api-key": "synthetic",
  "venice-api-key": "venice",
  "github-copilot": "github-copilot",
  "copilot-proxy": "copilot-proxy",
  "minimax-cloud": "minimax",
  "minimax-api": "minimax",
  "minimax-api-lightning": "minimax",
  minimax: "lmstudio",
  "opencode-zen": "opencode",
  "qwen-portal": "qwen-portal",
  "minimax-portal": "minimax-portal",
};

export function resolvePreferredProviderForAuthChoice(choice: AuthChoice): string | undefined {
  return PREFERRED_PROVIDER_BY_AUTH_CHOICE[choice];
}
