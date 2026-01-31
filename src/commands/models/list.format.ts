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

import { colorize, isRich as isRichTerminal, theme } from "../../terminal/theme.js";

export const isRich = (opts?: { json?: boolean; plain?: boolean }) =>
  Boolean(isRichTerminal() && !opts?.json && !opts?.plain);

export const pad = (value: string, size: number) => value.padEnd(size);

export const formatKey = (key: string, rich: boolean) => colorize(rich, theme.warn, key);

export const formatValue = (value: string, rich: boolean) => colorize(rich, theme.info, value);

export const formatKeyValue = (
  key: string,
  value: string,
  rich: boolean,
  valueColor: (value: string) => string = theme.info,
) => `${formatKey(key, rich)}=${colorize(rich, valueColor, value)}`;

export const formatSeparator = (rich: boolean) => colorize(rich, theme.muted, " | ");

export const formatTag = (tag: string, rich: boolean) => {
  if (!rich) {
    return tag;
  }
  if (tag === "default") {
    return theme.success(tag);
  }
  if (tag === "image") {
    return theme.accentBright(tag);
  }
  if (tag === "configured") {
    return theme.accent(tag);
  }
  if (tag === "missing") {
    return theme.error(tag);
  }
  if (tag.startsWith("fallback#")) {
    return theme.warn(tag);
  }
  if (tag.startsWith("img-fallback#")) {
    return theme.warn(tag);
  }
  if (tag.startsWith("alias:")) {
    return theme.accentDim(tag);
  }
  return theme.muted(tag);
};

export const truncate = (value: string, max: number) => {
  if (value.length <= max) {
    return value;
  }
  if (max <= 3) {
    return value.slice(0, max);
  }
  return `${value.slice(0, max - 3)}...`;
};

export const maskApiKey = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "missing";
  }
  if (trimmed.length <= 16) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`;
};
