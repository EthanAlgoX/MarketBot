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
import type { BrowserParentOpts } from "../browser-cli-shared.js";
import { registerBrowserElementCommands } from "./register.element.js";
import { registerBrowserFilesAndDownloadsCommands } from "./register.files-downloads.js";
import { registerBrowserFormWaitEvalCommands } from "./register.form-wait-eval.js";
import { registerBrowserNavigationCommands } from "./register.navigation.js";

export function registerBrowserActionInputCommands(
  browser: Command,
  parentOpts: (cmd: Command) => BrowserParentOpts,
) {
  registerBrowserNavigationCommands(browser, parentOpts);
  registerBrowserElementCommands(browser, parentOpts);
  registerBrowserFilesAndDownloadsCommands(browser, parentOpts);
  registerBrowserFormWaitEvalCommands(browser, parentOpts);
}
