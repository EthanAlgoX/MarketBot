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

export type FormatDurationSecondsOptions = {
  decimals?: number;
  unit?: "s" | "seconds";
};

export function formatDurationSeconds(
  ms: number,
  options: FormatDurationSecondsOptions = {},
): string {
  if (!Number.isFinite(ms)) {
    return "unknown";
  }
  const decimals = options.decimals ?? 1;
  const unit = options.unit ?? "s";
  const seconds = Math.max(0, ms) / 1000;
  const fixed = seconds.toFixed(Math.max(0, decimals));
  const trimmed = fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  return unit === "seconds" ? `${trimmed} seconds` : `${trimmed}s`;
}

export type FormatDurationMsOptions = {
  decimals?: number;
  unit?: "s" | "seconds";
};

export function formatDurationMs(ms: number, options: FormatDurationMsOptions = {}): string {
  if (!Number.isFinite(ms)) {
    return "unknown";
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return formatDurationSeconds(ms, {
    decimals: options.decimals ?? 2,
    unit: options.unit ?? "s",
  });
}
