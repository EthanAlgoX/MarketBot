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

import { normalizeProviderId } from "../agents/model-selection.js";
import type { UsageProviderId } from "./provider-usage.types.js";

export const DEFAULT_TIMEOUT_MS = 5000;

export const PROVIDER_LABELS: Record<UsageProviderId, string> = {
  anthropic: "Claude",
  "github-copilot": "Copilot",
  "google-gemini-cli": "Gemini",
  "google-antigravity": "Antigravity",
  minimax: "MiniMax",
  "openai-codex": "Codex",
  xiaomi: "Xiaomi",
  zai: "z.ai",
};

export const usageProviders: UsageProviderId[] = [
  "anthropic",
  "github-copilot",
  "google-gemini-cli",
  "google-antigravity",
  "minimax",
  "openai-codex",
  "xiaomi",
  "zai",
];

export function resolveUsageProviderId(provider?: string | null): UsageProviderId | undefined {
  if (!provider) {
    return undefined;
  }
  const normalized = normalizeProviderId(provider);
  return usageProviders.includes(normalized as UsageProviderId)
    ? (normalized as UsageProviderId)
    : undefined;
}

export const ignoredErrors = new Set([
  "No credentials",
  "No token",
  "No API key",
  "Not logged in",
  "No auth",
]);

export const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export const withTimeout = async <T>(work: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};
