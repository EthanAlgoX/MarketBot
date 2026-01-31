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

import type { SessionStatus } from "./status.types.js";

export const formatKTokens = (value: number) =>
  `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;

export const formatAge = (ms: number | null | undefined) => {
  if (!ms || ms < 0) {
    return "unknown";
  }
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export const formatDuration = (ms: number | null | undefined) => {
  if (ms == null || !Number.isFinite(ms)) {
    return "unknown";
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
};

export const shortenText = (value: string, maxLen: number) => {
  const chars = Array.from(value);
  if (chars.length <= maxLen) {
    return value;
  }
  return `${chars.slice(0, Math.max(0, maxLen - 1)).join("")}…`;
};

export const formatTokensCompact = (
  sess: Pick<SessionStatus, "totalTokens" | "contextTokens" | "percentUsed">,
) => {
  const used = sess.totalTokens ?? 0;
  const ctx = sess.contextTokens;
  if (!ctx) {
    return `${formatKTokens(used)} used`;
  }
  const pctLabel = sess.percentUsed != null ? `${sess.percentUsed}%` : "?%";
  return `${formatKTokens(used)}/${formatKTokens(ctx)} (${pctLabel})`;
};

export const formatDaemonRuntimeShort = (runtime?: {
  status?: string;
  pid?: number;
  state?: string;
  detail?: string;
  missingUnit?: boolean;
}) => {
  if (!runtime) {
    return null;
  }
  const status = runtime.status ?? "unknown";
  const details: string[] = [];
  if (runtime.pid) {
    details.push(`pid ${runtime.pid}`);
  }
  if (runtime.state && runtime.state.toLowerCase() !== status) {
    details.push(`state ${runtime.state}`);
  }
  const detail = runtime.detail?.replace(/\s+/g, " ").trim() || "";
  const noisyLaunchctlDetail =
    runtime.missingUnit === true && detail.toLowerCase().includes("could not find service");
  if (detail && !noisyLaunchctlDetail) {
    details.push(detail);
  }
  return details.length > 0 ? `${status} (${details.join(", ")})` : status;
};
