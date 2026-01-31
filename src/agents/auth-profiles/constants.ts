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

import { createSubsystemLogger } from "../../logging/subsystem.js";

export const AUTH_STORE_VERSION = 1;
export const AUTH_PROFILE_FILENAME = "auth-profiles.json";
export const LEGACY_AUTH_FILENAME = "auth.json";

export const CLAUDE_CLI_PROFILE_ID = "anthropic:claude-cli";
export const CODEX_CLI_PROFILE_ID = "openai-codex:codex-cli";
export const QWEN_CLI_PROFILE_ID = "qwen-portal:qwen-cli";
export const MINIMAX_CLI_PROFILE_ID = "minimax-portal:minimax-cli";

export const AUTH_STORE_LOCK_OPTIONS = {
  retries: {
    retries: 10,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 10_000,
    randomize: true,
  },
  stale: 30_000,
} as const;

export const EXTERNAL_CLI_SYNC_TTL_MS = 15 * 60 * 1000;
export const EXTERNAL_CLI_NEAR_EXPIRY_MS = 10 * 60 * 1000;

export const log = createSubsystemLogger("agents/auth-profiles");
