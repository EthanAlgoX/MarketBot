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

import type { Dirent, Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { isIndexableMemoryFile } from "./internal.js";
import {
  type MemoryPriority,
  resolveMemoryLayer,
  resolveMemoryPriority,
  resolvePriorityExpiryMs,
} from "./memory-meta.js";

const DEFAULT_P1_DAYS = 90;
const DEFAULT_P2_DAYS = 30;

export type MemoryJanitorMove = {
  from: string;
  to: string;
  priority: MemoryPriority;
  expiresAt: number;
};

export type MemoryJanitorResult = {
  scanned: number;
  expired: number;
  moved: MemoryJanitorMove[];
  dryRun: boolean;
};

async function collectMemoryFiles(dir: string): Promise<string[]> {
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name.toLowerCase() === "archive") {
        continue;
      }
      out.push(...(await collectMemoryFiles(abs)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (entry.name === ".abstract" || !isIndexableMemoryFile(entry.name)) {
      continue;
    }
    out.push(abs);
  }
  return out;
}

async function safeRename(from: string, to: string): Promise<string> {
  const toDir = path.dirname(to);
  await fs.mkdir(toDir, { recursive: true });
  try {
    await fs.rename(from, to);
    return to;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
      throw err;
    }
    const parsed = path.parse(to);
    const fallback = path.join(parsed.dir, `${parsed.name}-${Date.now()}${parsed.ext || ".bak"}`);
    await fs.rename(from, fallback);
    return fallback;
  }
}

export async function runMemoryJanitor(params: {
  workspaceDir: string;
  p1Days?: number;
  p2Days?: number;
  dryRun?: boolean;
  nowMs?: number;
}): Promise<MemoryJanitorResult> {
  const memoryDir = path.join(params.workspaceDir, "memory");
  const files = await collectMemoryFiles(memoryDir);
  const p1Days =
    typeof params.p1Days === "number" && Number.isFinite(params.p1Days)
      ? Math.max(0, Math.floor(params.p1Days))
      : DEFAULT_P1_DAYS;
  const p2Days =
    typeof params.p2Days === "number" && Number.isFinite(params.p2Days)
      ? Math.max(0, Math.floor(params.p2Days))
      : DEFAULT_P2_DAYS;
  const nowMs = params.nowMs ?? Date.now();

  const moves: MemoryJanitorMove[] = [];
  let expired = 0;

  for (const absPath of files) {
    const relPath = path.relative(params.workspaceDir, absPath).replace(/\\/g, "/");
    let content = "";
    let stat: Stats;
    try {
      stat = await fs.stat(absPath);
      content = await fs.readFile(absPath, "utf-8");
    } catch {
      continue;
    }
    const layer = resolveMemoryLayer({ source: "memory", relPath, content });
    const priority = resolveMemoryPriority({ source: "memory", relPath, layer, content });
    const expiresAt = resolvePriorityExpiryMs({
      priority,
      referenceMs: stat.mtimeMs,
      p1Days,
      p2Days,
    });
    if (expiresAt == null || expiresAt > nowMs) {
      continue;
    }
    expired += 1;
    const relativeFromMemory = path.relative(memoryDir, absPath).replace(/\\/g, "/");
    const destPath = path.join(memoryDir, "archive", relativeFromMemory);
    const finalDest = params.dryRun ? destPath : await safeRename(absPath, destPath);
    moves.push({
      from: absPath,
      to: finalDest,
      priority,
      expiresAt,
    });
  }

  return {
    scanned: files.length,
    expired,
    moved: moves,
    dryRun: Boolean(params.dryRun),
  };
}
