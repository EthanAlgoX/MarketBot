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

export { githubCopilotLoginCommand } from "../providers/github-copilot-auth.js";
export {
  modelsAliasesAddCommand,
  modelsAliasesListCommand,
  modelsAliasesRemoveCommand,
} from "./models/aliases.js";
export {
  modelsAuthAddCommand,
  modelsAuthLoginCommand,
  modelsAuthPasteTokenCommand,
  modelsAuthSetupTokenCommand,
} from "./models/auth.js";
export {
  modelsAuthOrderClearCommand,
  modelsAuthOrderGetCommand,
  modelsAuthOrderSetCommand,
} from "./models/auth-order.js";
export {
  modelsFallbacksAddCommand,
  modelsFallbacksClearCommand,
  modelsFallbacksListCommand,
  modelsFallbacksRemoveCommand,
} from "./models/fallbacks.js";
export {
  modelsImageFallbacksAddCommand,
  modelsImageFallbacksClearCommand,
  modelsImageFallbacksListCommand,
  modelsImageFallbacksRemoveCommand,
} from "./models/image-fallbacks.js";
export { modelsListCommand, modelsStatusCommand } from "./models/list.js";
export { modelsScanCommand } from "./models/scan.js";
export { modelsSetCommand } from "./models/set.js";
export { modelsSetImageCommand } from "./models/set-image.js";
