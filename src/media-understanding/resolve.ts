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

import type { MarketBotConfig } from "../config/config.js";
import type { MsgContext } from "../auto-reply/templating.js";
import type {
  MediaUnderstandingConfig,
  MediaUnderstandingModelConfig,
  MediaUnderstandingScopeConfig,
} from "../config/types.tools.js";
import { logVerbose, shouldLogVerbose } from "../globals.js";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_CHARS_BY_CAPABILITY,
  DEFAULT_MEDIA_CONCURRENCY,
  DEFAULT_PROMPT,
} from "./defaults.js";
import { normalizeMediaProviderId } from "./providers/index.js";
import { normalizeMediaUnderstandingChatType, resolveMediaUnderstandingScope } from "./scope.js";
import type { MediaUnderstandingCapability } from "./types.js";

export function resolveTimeoutMs(seconds: number | undefined, fallbackSeconds: number): number {
  const value = typeof seconds === "number" && Number.isFinite(seconds) ? seconds : fallbackSeconds;
  return Math.max(1000, Math.floor(value * 1000));
}

export function resolvePrompt(
  capability: MediaUnderstandingCapability,
  prompt?: string,
  maxChars?: number,
): string {
  const base = prompt?.trim() || DEFAULT_PROMPT[capability];
  if (!maxChars || capability === "audio") {
    return base;
  }
  return `${base} Respond in at most ${maxChars} characters.`;
}

export function resolveMaxChars(params: {
  capability: MediaUnderstandingCapability;
  entry: MediaUnderstandingModelConfig;
  cfg: MarketBotConfig;
  config?: MediaUnderstandingConfig;
}): number | undefined {
  const { capability, entry, cfg } = params;
  const configured =
    entry.maxChars ?? params.config?.maxChars ?? cfg.tools?.media?.[capability]?.maxChars;
  if (typeof configured === "number") {
    return configured;
  }
  return DEFAULT_MAX_CHARS_BY_CAPABILITY[capability];
}

export function resolveMaxBytes(params: {
  capability: MediaUnderstandingCapability;
  entry: MediaUnderstandingModelConfig;
  cfg: MarketBotConfig;
  config?: MediaUnderstandingConfig;
}): number {
  const configured =
    params.entry.maxBytes ??
    params.config?.maxBytes ??
    params.cfg.tools?.media?.[params.capability]?.maxBytes;
  if (typeof configured === "number") {
    return configured;
  }
  return DEFAULT_MAX_BYTES[params.capability];
}

export function resolveCapabilityConfig(
  cfg: MarketBotConfig,
  capability: MediaUnderstandingCapability,
): MediaUnderstandingConfig | undefined {
  return cfg.tools?.media?.[capability];
}

export function resolveScopeDecision(params: {
  scope?: MediaUnderstandingScopeConfig;
  ctx: MsgContext;
}): "allow" | "deny" {
  return resolveMediaUnderstandingScope({
    scope: params.scope,
    sessionKey: params.ctx.SessionKey,
    channel: params.ctx.Surface ?? params.ctx.Provider,
    chatType: normalizeMediaUnderstandingChatType(params.ctx.ChatType),
  });
}

function resolveEntryCapabilities(params: {
  entry: MediaUnderstandingModelConfig;
  providerRegistry: Map<string, { capabilities?: MediaUnderstandingCapability[] }>;
}): MediaUnderstandingCapability[] | undefined {
  const entryType = params.entry.type ?? (params.entry.command ? "cli" : "provider");
  if (entryType === "cli") {
    return undefined;
  }
  const providerId = normalizeMediaProviderId(params.entry.provider ?? "");
  if (!providerId) {
    return undefined;
  }
  return params.providerRegistry.get(providerId)?.capabilities;
}

export function resolveModelEntries(params: {
  cfg: MarketBotConfig;
  capability: MediaUnderstandingCapability;
  config?: MediaUnderstandingConfig;
  providerRegistry: Map<string, { capabilities?: MediaUnderstandingCapability[] }>;
}): MediaUnderstandingModelConfig[] {
  const { cfg, capability, config } = params;
  const sharedModels = cfg.tools?.media?.models ?? [];
  const entries = [
    ...(config?.models ?? []).map((entry) => ({ entry, source: "capability" as const })),
    ...sharedModels.map((entry) => ({ entry, source: "shared" as const })),
  ];
  if (entries.length === 0) {
    return [];
  }

  return entries
    .filter(({ entry, source }) => {
      const caps =
        entry.capabilities && entry.capabilities.length > 0
          ? entry.capabilities
          : source === "shared"
            ? resolveEntryCapabilities({ entry, providerRegistry: params.providerRegistry })
            : undefined;
      if (!caps || caps.length === 0) {
        if (source === "shared") {
          if (shouldLogVerbose()) {
            logVerbose(
              `Skipping shared media model without capabilities: ${entry.provider ?? entry.command ?? "unknown"}`,
            );
          }
          return false;
        }
        return true;
      }
      return caps.includes(capability);
    })
    .map(({ entry }) => entry);
}

export function resolveConcurrency(cfg: MarketBotConfig): number {
  const configured = cfg.tools?.media?.concurrency;
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }
  return DEFAULT_MEDIA_CONCURRENCY;
}

export function resolveEntriesWithActiveFallback(params: {
  cfg: MarketBotConfig;
  capability: MediaUnderstandingCapability;
  config?: MediaUnderstandingConfig;
  providerRegistry: Map<string, { capabilities?: MediaUnderstandingCapability[] }>;
  activeModel?: { provider: string; model?: string };
}): MediaUnderstandingModelConfig[] {
  const entries = resolveModelEntries({
    cfg: params.cfg,
    capability: params.capability,
    config: params.config,
    providerRegistry: params.providerRegistry,
  });
  if (entries.length > 0) {
    return entries;
  }
  if (params.config?.enabled !== true) {
    return entries;
  }
  const activeProviderRaw = params.activeModel?.provider?.trim();
  if (!activeProviderRaw) {
    return entries;
  }
  const activeProvider = normalizeMediaProviderId(activeProviderRaw);
  if (!activeProvider) {
    return entries;
  }
  const capabilities = params.providerRegistry.get(activeProvider)?.capabilities;
  if (!capabilities || !capabilities.includes(params.capability)) {
    return entries;
  }
  return [
    {
      type: "provider",
      provider: activeProvider,
      model: params.activeModel?.model,
    },
  ];
}
