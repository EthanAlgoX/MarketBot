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

import type { EffectiveContextPruningSettings } from "./settings.js";

export type ContextPruningRuntimeValue = {
  settings: EffectiveContextPruningSettings;
  contextWindowTokens?: number | null;
  isToolPrunable: (toolName: string) => boolean;
  lastCacheTouchAt?: number | null;
};

// Session-scoped runtime registry keyed by object identity.
// Important: this relies on Pi passing the same SessionManager object instance into
// ExtensionContext (ctx.sessionManager) that we used when calling setContextPruningRuntime.
const REGISTRY = new WeakMap<object, ContextPruningRuntimeValue>();

export function setContextPruningRuntime(
  sessionManager: unknown,
  value: ContextPruningRuntimeValue | null,
): void {
  if (!sessionManager || typeof sessionManager !== "object") {
    return;
  }

  const key = sessionManager;
  if (value === null) {
    REGISTRY.delete(key);
    return;
  }

  REGISTRY.set(key, value);
}

export function getContextPruningRuntime(
  sessionManager: unknown,
): ContextPruningRuntimeValue | null {
  if (!sessionManager || typeof sessionManager !== "object") {
    return null;
  }

  return REGISTRY.get(sessionManager) ?? null;
}
