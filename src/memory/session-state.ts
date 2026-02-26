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
import path from "node:path";

import { listMemoryFiles } from "./internal.js";
import { resolveMemoryLayer, resolveMemoryPriority } from "./memory-meta.js";

export type SessionStateRefreshResult = {
  outputPath: string;
  written: boolean;
  sourceFiles: string[];
};

function summaryLine(content: string): string {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return "(empty)";
  }
  const heading = lines.find((line) => line.startsWith("#"));
  const candidate = (heading ?? lines[0] ?? "(empty)").replace(/^#+\s*/, "");
  return candidate.length > 180 ? `${candidate.slice(0, 177)}...` : candidate;
}

function shouldInclude(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/").toLowerCase();
  if (normalized === "session-state.md") {
    return false;
  }
  if (normalized.endsWith("/.abstract") || normalized === "memory/.abstract") {
    return false;
  }
  if (normalized.includes("/archive/")) {
    return false;
  }
  return true;
}

function dedupeByRelPath<T extends { relPath: string }>(entries: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of entries) {
    if (seen.has(entry.relPath)) {
      continue;
    }
    seen.add(entry.relPath);
    out.push(entry);
  }
  return out;
}

export async function refreshSessionState(params: {
  workspaceDir: string;
  maxItems?: number;
}): Promise<SessionStateRefreshResult> {
  const outputPath = path.join(params.workspaceDir, "SESSION-STATE.md");
  const candidates = (await listMemoryFiles(params.workspaceDir)).filter((absPath) => {
    const relPath = path.relative(params.workspaceDir, absPath).replace(/\\/g, "/");
    return shouldInclude(relPath);
  });

  const entries = await Promise.all(
    candidates.map(async (absPath) => {
      const relPath = path.relative(params.workspaceDir, absPath).replace(/\\/g, "/");
      try {
        const stat = await fs.stat(absPath);
        const content = await fs.readFile(absPath, "utf-8");
        const layer = resolveMemoryLayer({ source: "memory", relPath, content });
        const priority = resolveMemoryPriority({ source: "memory", relPath, layer, content });
        return {
          absPath,
          relPath,
          mtimeMs: stat.mtimeMs,
          layer,
          priority,
          summary: summaryLine(content),
        };
      } catch {
        return null;
      }
    }),
  );

  const usable = entries
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .toSorted((a, b) => {
      const mtimeDelta = b.mtimeMs - a.mtimeMs;
      if (mtimeDelta !== 0) {
        return mtimeDelta;
      }
      return a.relPath.localeCompare(b.relPath);
    });

  const maxItems = Math.max(1, params.maxItems ?? 12);
  const nowItems = dedupeByRelPath(usable.slice(0, maxItems));
  const persistent = dedupeByRelPath(
    usable.filter((entry) => entry.priority === "p0" || entry.priority === "p1").slice(0, maxItems),
  );
  const latestMtimeMs = Math.max(
    0,
    ...nowItems.map((entry) => Math.floor(entry.mtimeMs)),
    ...persistent.map((entry) => Math.floor(entry.mtimeMs)),
  );
  const updatedLabel = latestMtimeMs > 0 ? new Date(latestMtimeMs).toISOString() : "n/a";

  const lines = [
    "# SESSION-STATE",
    "",
    `Updated: ${updatedLabel}`,
    "",
    "## Working Set",
    ...nowItems.map(
      (entry) =>
        `- [${entry.layer.toUpperCase()}|${entry.priority.toUpperCase()}] ${entry.relPath}: ${entry.summary}`,
    ),
    ...(nowItems.length === 0 ? ["- (none)"] : []),
    "",
    "## Persistent Context",
    ...persistent.map(
      (entry) =>
        `- [${entry.layer.toUpperCase()}|${entry.priority.toUpperCase()}] ${entry.relPath}: ${entry.summary}`,
    ),
    ...(persistent.length === 0 ? ["- (none)"] : []),
    "",
    "## Retrieval Hint",
    "This file is a hot working buffer. Query L0 first, then drill into L1/L2 only when needed.",
    "",
  ];

  const next = lines.join("\n");
  let prev = "";
  try {
    prev = await fs.readFile(outputPath, "utf-8");
  } catch {}
  if (prev === next) {
    return { outputPath, written: false, sourceFiles: nowItems.map((entry) => entry.relPath) };
  }
  await fs.writeFile(outputPath, next, "utf-8");
  return { outputPath, written: true, sourceFiles: nowItems.map((entry) => entry.relPath) };
}
