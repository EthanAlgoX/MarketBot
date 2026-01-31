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

import type { MarketBotConfig } from "../config/types.js";

export type CommandScope = "text" | "native" | "both";

export type CommandCategory =
  | "session"
  | "options"
  | "status"
  | "management"
  | "media"
  | "tools"
  | "docks";

export type CommandArgType = "string" | "number" | "boolean";

export type CommandArgChoiceContext = {
  cfg?: MarketBotConfig;
  provider?: string;
  model?: string;
  command: ChatCommandDefinition;
  arg: CommandArgDefinition;
};

export type CommandArgChoice = string | { value: string; label: string };

export type CommandArgChoicesProvider = (context: CommandArgChoiceContext) => CommandArgChoice[];

export type CommandArgDefinition = {
  name: string;
  description: string;
  type: CommandArgType;
  required?: boolean;
  choices?: CommandArgChoice[] | CommandArgChoicesProvider;
  captureRemaining?: boolean;
};

export type CommandArgMenuSpec = {
  arg: string;
  title?: string;
};

export type CommandArgValue = string | number | boolean | bigint;
export type CommandArgValues = Record<string, CommandArgValue>;

export type CommandArgs = {
  raw?: string;
  values?: CommandArgValues;
};

export type CommandArgsParsing = "none" | "positional";

export type ChatCommandDefinition = {
  key: string;
  nativeName?: string;
  description: string;
  textAliases: string[];
  acceptsArgs?: boolean;
  args?: CommandArgDefinition[];
  argsParsing?: CommandArgsParsing;
  formatArgs?: (values: CommandArgValues) => string | undefined;
  argsMenu?: CommandArgMenuSpec | "auto";
  scope: CommandScope;
  category?: CommandCategory;
};

export type NativeCommandSpec = {
  name: string;
  description: string;
  acceptsArgs: boolean;
  args?: CommandArgDefinition[];
};

export type CommandNormalizeOptions = {
  botUsername?: string;
};

export type CommandDetection = {
  exact: Set<string>;
  regex: RegExp;
};

export type ShouldHandleTextCommandsParams = {
  cfg: MarketBotConfig;
  surface: string;
  commandSource?: "text" | "native";
};
