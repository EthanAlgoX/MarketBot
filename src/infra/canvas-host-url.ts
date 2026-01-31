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

type HostSource = string | null | undefined;

type CanvasHostUrlParams = {
  canvasPort?: number;
  hostOverride?: HostSource;
  requestHost?: HostSource;
  forwardedProto?: HostSource | HostSource[];
  localAddress?: HostSource;
  scheme?: "http" | "https";
};

const isLoopbackHost = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === "localhost") {
    return true;
  }
  if (normalized === "::1") {
    return true;
  }
  if (normalized === "0.0.0.0" || normalized === "::") {
    return true;
  }
  return normalized.startsWith("127.");
};

const normalizeHost = (value: HostSource, rejectLoopback: boolean) => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (rejectLoopback && isLoopbackHost(trimmed)) {
    return "";
  }
  return trimmed;
};

const parseHostHeader = (value: HostSource) => {
  if (!value) {
    return "";
  }
  try {
    return new URL(`http://${String(value).trim()}`).hostname;
  } catch {
    return "";
  }
};

const parseForwardedProto = (value: HostSource | HostSource[]) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export function resolveCanvasHostUrl(params: CanvasHostUrlParams) {
  const port = params.canvasPort;
  if (!port) {
    return undefined;
  }

  const scheme =
    params.scheme ??
    (parseForwardedProto(params.forwardedProto)?.trim() === "https" ? "https" : "http");

  const override = normalizeHost(params.hostOverride, true);
  const requestHost = normalizeHost(parseHostHeader(params.requestHost), !!override);
  const localAddress = normalizeHost(params.localAddress, Boolean(override || requestHost));

  const host = override || requestHost || localAddress;
  if (!host) {
    return undefined;
  }
  const formatted = host.includes(":") ? `[${host}]` : host;
  return `${scheme}://${formatted}:${port}`;
}
