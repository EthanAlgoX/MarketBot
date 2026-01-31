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

export { CLAUDE_CLI_PROFILE_ID, CODEX_CLI_PROFILE_ID } from "./auth-profiles/constants.js";
export { resolveAuthProfileDisplayLabel } from "./auth-profiles/display.js";
export { formatAuthDoctorHint } from "./auth-profiles/doctor.js";
export { resolveApiKeyForProfile } from "./auth-profiles/oauth.js";
export { resolveAuthProfileOrder } from "./auth-profiles/order.js";
export { resolveAuthStorePathForDisplay } from "./auth-profiles/paths.js";
export {
  listProfilesForProvider,
  markAuthProfileGood,
  setAuthProfileOrder,
  upsertAuthProfile,
} from "./auth-profiles/profiles.js";
export {
  repairOAuthProfileIdMismatch,
  suggestOAuthProfileIdForLegacyDefault,
} from "./auth-profiles/repair.js";
export {
  ensureAuthProfileStore,
  loadAuthProfileStore,
  saveAuthProfileStore,
} from "./auth-profiles/store.js";
export type {
  ApiKeyCredential,
  AuthProfileCredential,
  AuthProfileFailureReason,
  AuthProfileIdRepairResult,
  AuthProfileStore,
  OAuthCredential,
  ProfileUsageStats,
  TokenCredential,
} from "./auth-profiles/types.js";
export {
  calculateAuthProfileCooldownMs,
  clearAuthProfileCooldown,
  isProfileInCooldown,
  markAuthProfileCooldown,
  markAuthProfileFailure,
  markAuthProfileUsed,
  resolveProfileUnusableUntilForDisplay,
} from "./auth-profiles/usage.js";
