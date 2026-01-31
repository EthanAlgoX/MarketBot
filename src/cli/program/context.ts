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

import { VERSION } from "../../version.js";
import { resolveCliChannelOptions } from "../channel-options.js";

export type ProgramContext = {
  programVersion: string;
  channelOptions: string[];
  messageChannelOptions: string;
  agentChannelOptions: string;
};

export function createProgramContext(): ProgramContext {
  const channelOptions = resolveCliChannelOptions();
  return {
    programVersion: VERSION,
    channelOptions,
    messageChannelOptions: channelOptions.join("|"),
    agentChannelOptions: ["last", ...channelOptions].join("|"),
  };
}
