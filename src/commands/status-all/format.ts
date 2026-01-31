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

export function formatGatewayAuthUsed(
  auth: {
    token?: string;
    password?: string;
  } | null,
): "token" | "password" | "token+password" | "none" {
  const hasToken = Boolean(auth?.token?.trim());
  const hasPassword = Boolean(auth?.password?.trim());
  if (hasToken && hasPassword) {
    return "token+password";
  }
  if (hasToken) {
    return "token";
  }
  if (hasPassword) {
    return "password";
  }
  return "none";
}

export function redactSecrets(text: string): string {
  if (!text) {
    return text;
  }
  let out = text;
  out = out.replace(
    /(\b(?:access[_-]?token|refresh[_-]?token|token|password|secret|api[_-]?key)\b\s*[:=]\s*)("?)([^"\\s]+)("?)/gi,
    "$1$2***$4",
  );
  out = out.replace(/\bBearer\s+[A-Za-z0-9._-]+\b/g, "Bearer ***");
  out = out.replace(/\bsk-[A-Za-z0-9]{10,}\b/g, "sk-***");
  return out;
}
