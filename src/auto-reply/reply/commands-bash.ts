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

import { logVerbose } from "../../globals.js";
import { handleBashChatCommand } from "./bash-command.js";
import type { CommandHandler } from "./commands-types.js";

export const handleBashCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const { command } = params;
  const bashSlashRequested =
    command.commandBodyNormalized === "/bash" || command.commandBodyNormalized.startsWith("/bash ");
  const bashBangRequested = command.commandBodyNormalized.startsWith("!");
  if (!bashSlashRequested && !(bashBangRequested && command.isAuthorizedSender)) {
    return null;
  }
  if (!command.isAuthorizedSender) {
    logVerbose(`Ignoring /bash from unauthorized sender: ${command.senderId || "<unknown>"}`);
    return { shouldContinue: false };
  }
  const reply = await handleBashChatCommand({
    ctx: params.ctx,
    cfg: params.cfg,
    agentId: params.agentId,
    sessionKey: params.sessionKey,
    isGroup: params.isGroup,
    elevated: params.elevated,
  });
  return { shouldContinue: false, reply };
};
