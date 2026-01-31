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

import type { CliDeps } from "../../../cli/deps.js";
import { createDefaultDeps } from "../../../cli/deps.js";
import type { MarketBotConfig } from "../../../config/config.js";
import { runBootOnce } from "../../../gateway/boot.js";
import type { HookHandler } from "../../hooks.js";

type BootHookContext = {
  cfg?: MarketBotConfig;
  workspaceDir?: string;
  deps?: CliDeps;
};

const runBootChecklist: HookHandler = async (event) => {
  if (event.type !== "gateway" || event.action !== "startup") {
    return;
  }

  const context = (event.context ?? {}) as BootHookContext;
  if (!context.cfg || !context.workspaceDir) {
    return;
  }

  const deps = context.deps ?? createDefaultDeps();
  await runBootOnce({ cfg: context.cfg, deps, workspaceDir: context.workspaceDir });
};

export default runBootChecklist;
