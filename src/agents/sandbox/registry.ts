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

import fs from "node:fs/promises";

import {
  SANDBOX_BROWSER_REGISTRY_PATH,
  SANDBOX_REGISTRY_PATH,
  SANDBOX_STATE_DIR,
} from "./constants.js";

export type SandboxRegistryEntry = {
  containerName: string;
  sessionKey: string;
  createdAtMs: number;
  lastUsedAtMs: number;
  image: string;
  configHash?: string;
};

type SandboxRegistry = {
  entries: SandboxRegistryEntry[];
};

export type SandboxBrowserRegistryEntry = {
  containerName: string;
  sessionKey: string;
  createdAtMs: number;
  lastUsedAtMs: number;
  image: string;
  cdpPort: number;
  noVncPort?: number;
};

type SandboxBrowserRegistry = {
  entries: SandboxBrowserRegistryEntry[];
};

export async function readRegistry(): Promise<SandboxRegistry> {
  try {
    const raw = await fs.readFile(SANDBOX_REGISTRY_PATH, "utf-8");
    const parsed = JSON.parse(raw) as SandboxRegistry;
    if (parsed && Array.isArray(parsed.entries)) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return { entries: [] };
}

async function writeRegistry(registry: SandboxRegistry) {
  await fs.mkdir(SANDBOX_STATE_DIR, { recursive: true });
  await fs.writeFile(SANDBOX_REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
}

export async function updateRegistry(entry: SandboxRegistryEntry) {
  const registry = await readRegistry();
  const existing = registry.entries.find((item) => item.containerName === entry.containerName);
  const next = registry.entries.filter((item) => item.containerName !== entry.containerName);
  next.push({
    ...entry,
    createdAtMs: existing?.createdAtMs ?? entry.createdAtMs,
    image: existing?.image ?? entry.image,
    configHash: entry.configHash ?? existing?.configHash,
  });
  await writeRegistry({ entries: next });
}

export async function removeRegistryEntry(containerName: string) {
  const registry = await readRegistry();
  const next = registry.entries.filter((item) => item.containerName !== containerName);
  if (next.length === registry.entries.length) {
    return;
  }
  await writeRegistry({ entries: next });
}

export async function readBrowserRegistry(): Promise<SandboxBrowserRegistry> {
  try {
    const raw = await fs.readFile(SANDBOX_BROWSER_REGISTRY_PATH, "utf-8");
    const parsed = JSON.parse(raw) as SandboxBrowserRegistry;
    if (parsed && Array.isArray(parsed.entries)) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return { entries: [] };
}

async function writeBrowserRegistry(registry: SandboxBrowserRegistry) {
  await fs.mkdir(SANDBOX_STATE_DIR, { recursive: true });
  await fs.writeFile(
    SANDBOX_BROWSER_REGISTRY_PATH,
    `${JSON.stringify(registry, null, 2)}\n`,
    "utf-8",
  );
}

export async function updateBrowserRegistry(entry: SandboxBrowserRegistryEntry) {
  const registry = await readBrowserRegistry();
  const existing = registry.entries.find((item) => item.containerName === entry.containerName);
  const next = registry.entries.filter((item) => item.containerName !== entry.containerName);
  next.push({
    ...entry,
    createdAtMs: existing?.createdAtMs ?? entry.createdAtMs,
    image: existing?.image ?? entry.image,
  });
  await writeBrowserRegistry({ entries: next });
}

export async function removeBrowserRegistryEntry(containerName: string) {
  const registry = await readBrowserRegistry();
  const next = registry.entries.filter((item) => item.containerName !== containerName);
  if (next.length === registry.entries.length) {
    return;
  }
  await writeBrowserRegistry({ entries: next });
}
