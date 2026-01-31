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

import type { CommandArgValues } from "./commands-registry.types.js";

export type CommandArgsFormatter = (values: CommandArgValues) => string | undefined;

function normalizeArgValue(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  let text: string;
  if (typeof value === "string") {
    text = value.trim();
  } else if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    text = String(value).trim();
  } else if (typeof value === "symbol") {
    text = value.toString().trim();
  } else if (typeof value === "function") {
    text = value.toString().trim();
  } else {
    // Objects and arrays
    text = JSON.stringify(value);
  }
  return text ? text : undefined;
}

const formatConfigArgs: CommandArgsFormatter = (values) => {
  const action = normalizeArgValue(values.action)?.toLowerCase();
  const path = normalizeArgValue(values.path);
  const value = normalizeArgValue(values.value);
  if (!action) {
    return undefined;
  }
  if (action === "show" || action === "get") {
    return path ? `${action} ${path}` : action;
  }
  if (action === "unset") {
    return path ? `${action} ${path}` : action;
  }
  if (action === "set") {
    if (!path) {
      return action;
    }
    if (!value) {
      return `${action} ${path}`;
    }
    return `${action} ${path}=${value}`;
  }
  return action;
};

const formatDebugArgs: CommandArgsFormatter = (values) => {
  const action = normalizeArgValue(values.action)?.toLowerCase();
  const path = normalizeArgValue(values.path);
  const value = normalizeArgValue(values.value);
  if (!action) {
    return undefined;
  }
  if (action === "show" || action === "reset") {
    return action;
  }
  if (action === "unset") {
    return path ? `${action} ${path}` : action;
  }
  if (action === "set") {
    if (!path) {
      return action;
    }
    if (!value) {
      return `${action} ${path}`;
    }
    return `${action} ${path}=${value}`;
  }
  return action;
};

const formatQueueArgs: CommandArgsFormatter = (values) => {
  const mode = normalizeArgValue(values.mode);
  const debounce = normalizeArgValue(values.debounce);
  const cap = normalizeArgValue(values.cap);
  const drop = normalizeArgValue(values.drop);
  const parts: string[] = [];
  if (mode) {
    parts.push(mode);
  }
  if (debounce) {
    parts.push(`debounce:${debounce}`);
  }
  if (cap) {
    parts.push(`cap:${cap}`);
  }
  if (drop) {
    parts.push(`drop:${drop}`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
};

export const COMMAND_ARG_FORMATTERS: Record<string, CommandArgsFormatter> = {
  config: formatConfigArgs,
  debug: formatDebugArgs,
  queue: formatQueueArgs,
};
