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

export type BrowserProfileConfig = {
  /** CDP port for this profile. Allocated once at creation, persisted permanently. */
  cdpPort?: number;
  /** CDP URL for this profile (use for remote Chrome). */
  cdpUrl?: string;
  /** Profile color (hex). Auto-assigned at creation. */
  color: string;
};
export type BrowserSnapshotDefaults = {
  /** Default snapshot mode (applies when mode is not provided). */
  mode?: "efficient";
};
export type BrowserConfig = {
  enabled?: boolean;
  /** If false, disable browser act:evaluate (arbitrary JS). Default: true */
  evaluateEnabled?: boolean;
  /** Base URL of the CDP endpoint (for remote browsers). Default: loopback CDP on the derived port. */
  cdpUrl?: string;
  /** Remote CDP HTTP timeout (ms). Default: 1500. */
  remoteCdpTimeoutMs?: number;
  /** Remote CDP WebSocket handshake timeout (ms). Default: max(remoteCdpTimeoutMs * 2, 2000). */
  remoteCdpHandshakeTimeoutMs?: number;
  /** Accent color for the marketbot browser profile (hex). Default: #FF4500 */
  color?: string;
  /** Override the browser executable path (all platforms). */
  executablePath?: string;
  /** Start Chrome headless (best-effort). Default: false */
  headless?: boolean;
  /** Pass --no-sandbox to Chrome (Linux containers). Default: false */
  noSandbox?: boolean;
  /** If true: never launch; only attach to an existing browser. Default: false */
  attachOnly?: boolean;
  /** Default profile to use when profile param is omitted. Default: "marketbot" */
  defaultProfile?: string;
  /** Named browser profiles with explicit CDP ports or URLs. */
  profiles?: Record<string, BrowserProfileConfig>;
  /** Default snapshot options (applied by the browser tool/CLI when unset). */
  snapshotDefaults?: BrowserSnapshotDefaults;
};
