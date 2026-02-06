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

import type { BrowserConfig, BrowserProfileConfig, MarketBotConfig } from "../config/config.js";
import {
  deriveDefaultBrowserCdpPortRange,
  deriveDefaultBrowserControlPort,
  DEFAULT_BROWSER_CONTROL_PORT,
} from "../config/port-defaults.js";
import { resolveGatewayPort } from "../config/paths.js";
import {
  DEFAULT_MARKETBOT_BROWSER_COLOR,
  DEFAULT_MARKETBOT_BROWSER_ENABLED,
  DEFAULT_BROWSER_EVALUATE_ENABLED,
  DEFAULT_MARKETBOT_BROWSER_PROFILE_NAME,
} from "./constants.js";
import { CDP_PORT_RANGE_START } from "./profiles.js";

export type ResolvedBrowserConfig = {
  enabled: boolean;
  evaluateEnabled: boolean;
  controlPort: number;
  cdpProtocol: "http" | "https";
  cdpHost: string;
  cdpIsLoopback: boolean;
  remoteCdpTimeoutMs: number;
  remoteCdpHandshakeTimeoutMs: number;
  color: string;
  executablePath?: string;
  headless: boolean;
  noSandbox: boolean;
  attachOnly: boolean;
  defaultProfile: string;
  profiles: Record<string, BrowserProfileConfig>;
};

export type ResolvedBrowserProfile = {
  name: string;
  cdpPort: number;
  cdpUrl: string;
  cdpHost: string;
  cdpIsLoopback: boolean;
  color: string;
  driver: "marketbot";
};

function isLoopbackHost(host: string) {
  const h = host.trim().toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "[::1]" ||
    h === "::1" ||
    h === "[::]" ||
    h === "::"
  );
}

function normalizeHexColor(raw: string | undefined) {
  const value = (raw ?? "").trim();
  if (!value) {
    return DEFAULT_MARKETBOT_BROWSER_COLOR;
  }
  const normalized = value.startsWith("#") ? value : `#${value}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return DEFAULT_MARKETBOT_BROWSER_COLOR;
  }
  return normalized.toUpperCase();
}

function normalizeTimeoutMs(raw: number | undefined, fallback: number) {
  const value = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : fallback;
  return value < 0 ? fallback : value;
}

export function parseHttpUrl(raw: string, label: string) {
  const trimmed = raw.trim();
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must be http(s), got: ${parsed.protocol.replace(":", "")}`);
  }

  const port =
    parsed.port && Number.parseInt(parsed.port, 10) > 0
      ? Number.parseInt(parsed.port, 10)
      : parsed.protocol === "https:"
        ? 443
        : 80;

  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`${label} has invalid port: ${parsed.port}`);
  }

  return {
    parsed,
    port,
    normalized: parsed.toString().replace(/\/$/, ""),
  };
}

/**
 * Ensure the default "marketbot" profile exists in the profiles map.
 * Auto-creates it with the legacy CDP port (from browser.cdpUrl) or first port if missing.
 */
function ensureDefaultProfile(
  profiles: Record<string, BrowserProfileConfig> | undefined,
  defaultColor: string,
  legacyCdpPort?: number,
  derivedDefaultCdpPort?: number,
): Record<string, BrowserProfileConfig> {
  const result = { ...profiles };
  if (!result[DEFAULT_MARKETBOT_BROWSER_PROFILE_NAME]) {
    result[DEFAULT_MARKETBOT_BROWSER_PROFILE_NAME] = {
      cdpPort: legacyCdpPort ?? derivedDefaultCdpPort ?? CDP_PORT_RANGE_START,
      color: defaultColor,
    };
  }
  return result;
}

export function resolveBrowserConfig(
  cfg: BrowserConfig | undefined,
  rootConfig?: MarketBotConfig,
): ResolvedBrowserConfig {
  const enabled = cfg?.enabled ?? DEFAULT_MARKETBOT_BROWSER_ENABLED;
  const evaluateEnabled = cfg?.evaluateEnabled ?? DEFAULT_BROWSER_EVALUATE_ENABLED;
  const gatewayPort = resolveGatewayPort(rootConfig);
  const controlPort = deriveDefaultBrowserControlPort(gatewayPort ?? DEFAULT_BROWSER_CONTROL_PORT);
  const defaultColor = normalizeHexColor(cfg?.color);
  const remoteCdpTimeoutMs = normalizeTimeoutMs(cfg?.remoteCdpTimeoutMs, 1500);
  const remoteCdpHandshakeTimeoutMs = normalizeTimeoutMs(
    cfg?.remoteCdpHandshakeTimeoutMs,
    Math.max(2000, remoteCdpTimeoutMs * 2),
  );

  const derivedCdpRange = deriveDefaultBrowserCdpPortRange(controlPort);

  const rawCdpUrl = (cfg?.cdpUrl ?? "").trim();
  let cdpInfo:
    | {
        parsed: URL;
        port: number;
        normalized: string;
      }
    | undefined;
  if (rawCdpUrl) {
    cdpInfo = parseHttpUrl(rawCdpUrl, "browser.cdpUrl");
  } else {
    const derivedPort = controlPort + 1;
    if (derivedPort > 65535) {
      throw new Error(
        `Derived CDP port (${derivedPort}) is too high; check gateway port configuration.`,
      );
    }
    const derived = new URL(`http://127.0.0.1:${derivedPort}`);
    cdpInfo = {
      parsed: derived,
      port: derivedPort,
      normalized: derived.toString().replace(/\/$/, ""),
    };
  }

  const headless = cfg?.headless === true;
  const noSandbox = cfg?.noSandbox === true;
  const attachOnly = cfg?.attachOnly === true;
  const executablePath = cfg?.executablePath?.trim() || undefined;

  const defaultProfileFromConfig = cfg?.defaultProfile?.trim() || undefined;
  // Use legacy cdpUrl port for backward compatibility when no profiles configured
  const legacyCdpPort = rawCdpUrl ? cdpInfo.port : undefined;
  const profiles = ensureDefaultProfile(
    cfg?.profiles,
    defaultColor,
    legacyCdpPort,
    derivedCdpRange.start,
  );
  const cdpProtocol = cdpInfo.parsed.protocol === "https:" ? "https" : "http";
  const defaultProfile = defaultProfileFromConfig ?? DEFAULT_MARKETBOT_BROWSER_PROFILE_NAME;

  return {
    enabled,
    evaluateEnabled,
    controlPort,
    cdpProtocol,
    cdpHost: cdpInfo.parsed.hostname,
    cdpIsLoopback: isLoopbackHost(cdpInfo.parsed.hostname),
    remoteCdpTimeoutMs,
    remoteCdpHandshakeTimeoutMs,
    color: defaultColor,
    executablePath,
    headless,
    noSandbox,
    attachOnly,
    defaultProfile,
    profiles,
  };
}

/**
 * Resolve a profile by name from the config.
 * Returns null if the profile doesn't exist.
 */
export function resolveProfile(
  resolved: ResolvedBrowserConfig,
  profileName: string,
): ResolvedBrowserProfile | null {
  const profile = resolved.profiles[profileName];
  if (!profile) {
    return null;
  }

  const rawProfileUrl = profile.cdpUrl?.trim() ?? "";
  let cdpHost = resolved.cdpHost;
  let cdpPort = profile.cdpPort ?? 0;
  let cdpUrl = "";

  if (rawProfileUrl) {
    const parsed = parseHttpUrl(rawProfileUrl, `browser.profiles.${profileName}.cdpUrl`);
    cdpHost = parsed.parsed.hostname;
    cdpPort = parsed.port;
    cdpUrl = parsed.normalized;
  } else if (cdpPort) {
    cdpUrl = `${resolved.cdpProtocol}://${resolved.cdpHost}:${cdpPort}`;
  } else {
    throw new Error(`Profile "${profileName}" must define cdpPort or cdpUrl.`);
  }

  return {
    name: profileName,
    cdpPort,
    cdpUrl,
    cdpHost,
    cdpIsLoopback: isLoopbackHost(cdpHost),
    color: profile.color,
    driver: "marketbot",
  };
}

export function shouldStartLocalBrowserServer(_resolved: ResolvedBrowserConfig) {
  return true;
}
