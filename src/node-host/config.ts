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

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { resolveStateDir } from "../config/paths.js";

export type NodeHostGatewayConfig = {
  host?: string;
  port?: number;
  tls?: boolean;
  tlsFingerprint?: string;
};

export type NodeHostConfig = {
  version: 1;
  nodeId: string;
  token?: string;
  displayName?: string;
  gateway?: NodeHostGatewayConfig;
};

const NODE_HOST_FILE = "node.json";

export function resolveNodeHostConfigPath(): string {
  return path.join(resolveStateDir(), NODE_HOST_FILE);
}

function normalizeConfig(config: Partial<NodeHostConfig> | null): NodeHostConfig {
  const base: NodeHostConfig = {
    version: 1,
    nodeId: "",
    token: config?.token,
    displayName: config?.displayName,
    gateway: config?.gateway,
  };
  if (config?.version === 1 && typeof config.nodeId === "string") {
    base.nodeId = config.nodeId.trim();
  }
  if (!base.nodeId) {
    base.nodeId = crypto.randomUUID();
  }
  return base;
}

export async function loadNodeHostConfig(): Promise<NodeHostConfig | null> {
  const filePath = resolveNodeHostConfigPath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<NodeHostConfig>;
    return normalizeConfig(parsed);
  } catch {
    return null;
  }
}

export async function saveNodeHostConfig(config: NodeHostConfig): Promise<void> {
  const filePath = resolveNodeHostConfigPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload = JSON.stringify(config, null, 2);
  await fs.writeFile(filePath, `${payload}\n`, { mode: 0o600 });
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // best-effort on platforms without chmod
  }
}

export async function ensureNodeHostConfig(): Promise<NodeHostConfig> {
  const existing = await loadNodeHostConfig();
  const normalized = normalizeConfig(existing);
  await saveNodeHostConfig(normalized);
  return normalized;
}
