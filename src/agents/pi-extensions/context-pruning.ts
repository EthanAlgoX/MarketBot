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

/**
 * Opt-in context pruning (“microcompact”-style) for Pi sessions.
 *
 * This only affects the in-memory context for the current request; it does not rewrite session
 * history persisted on disk.
 */

export { default } from "./context-pruning/extension.js";

export { pruneContextMessages } from "./context-pruning/pruner.js";
export type {
  ContextPruningConfig,
  ContextPruningToolMatch,
  EffectiveContextPruningSettings,
} from "./context-pruning/settings.js";
export {
  computeEffectiveSettings,
  DEFAULT_CONTEXT_PRUNING_SETTINGS,
} from "./context-pruning/settings.js";
