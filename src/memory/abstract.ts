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

import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { isIndexableMemoryFile } from "./internal.js";
import { resolveMemoryLayer, resolveMemoryPriority } from "./memory-meta.js";

const ABSTRACT_FILENAME = ".abstract";
const CROSS_REF_MAX_ITEMS = 12;
const CROSS_REF_MAX_FILES_PER_TOPIC = 3;
const CROSS_REF_STOP_WORDS = new Set([
  "about",
  "after",
  "agent",
  "alpha",
  "beta",
  "build",
  "check",
  "daily",
  "entry",
  "error",
  "file",
  "files",
  "from",
  "have",
  "into",
  "just",
  "line",
  "lines",
  "log",
  "logs",
  "main",
  "memory",
  "note",
  "notes",
  "only",
  "part",
  "read",
  "root",
  "session",
  "setup",
  "state",
  "that",
  "this",
  "todo",
  "tool",
  "update",
  "use",
  "with",
]);

export type MemoryAbstractRebuildResult = {
  scannedDirs: number;
  written: string[];
};

async function collectDirs(rootDir: string, includeArchive: boolean): Promise<string[]> {
  const out: string[] = [];
  const queue = [rootDir];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    out.push(current);
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        continue;
      }
      if (!includeArchive && entry.name.toLowerCase() === "archive") {
        continue;
      }
      queue.push(path.join(current, entry.name));
    }
  }
  return out.toSorted((a, b) => a.localeCompare(b));
}

function firstSummaryLine(content: string): string {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return "(empty)";
  }
  const heading = lines.find((line) => line.startsWith("#"));
  const candidate = heading ?? lines[0] ?? "(empty)";
  const normalized = candidate.replace(/^#+\s*/, "");
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

async function describeFile(absPath: string, relPath: string): Promise<string> {
  const content = await fs.readFile(absPath, "utf-8");
  const layer = resolveMemoryLayer({ source: "memory", relPath, content });
  const priority = resolveMemoryPriority({ source: "memory", relPath, layer, content });
  const summary = firstSummaryLine(content);
  return `- [${layer.toUpperCase()}|${priority.toUpperCase()}] ${path.basename(relPath)}: ${summary}`;
}

function topLevelScope(relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/");
  if (!normalized.startsWith("memory/")) {
    return "external";
  }
  const rest = normalized.slice("memory/".length);
  const [first] = rest.split("/");
  if (!first) {
    return "root";
  }
  if (first.includes(".")) {
    return "root";
  }
  return first.toLowerCase();
}

function normalizeTopicToken(token: string): string | null {
  const normalized = token
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  if (normalized.length < 4) {
    return null;
  }
  if (/^\d+$/.test(normalized)) {
    return null;
  }
  if (CROSS_REF_STOP_WORDS.has(normalized)) {
    return null;
  }
  return normalized;
}

function collectTopicTokens(relPath: string, summary: string): string[] {
  const base = path.basename(relPath, path.extname(relPath));
  const raw = `${base} ${summary}`;
  const out = new Set<string>();
  for (const token of raw.split(/[^A-Za-z0-9_]+/g)) {
    const normalized = normalizeTopicToken(token);
    if (normalized) {
      out.add(normalized);
    }
  }
  return Array.from(out);
}

async function collectIndexableFiles(dir: string, includeArchive: boolean): Promise<string[]> {
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
      if (!includeArchive && entry.name.toLowerCase() === "archive") {
        continue;
      }
      out.push(...(await collectIndexableFiles(abs, includeArchive)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (entry.name === ABSTRACT_FILENAME || !isIndexableMemoryFile(entry.name)) {
      continue;
    }
    out.push(abs);
  }
  return out;
}

async function buildRootCrossReferences(params: {
  workspaceDir: string;
  memoryRootDir: string;
  includeArchive: boolean;
}): Promise<string[]> {
  const files = await collectIndexableFiles(params.memoryRootDir, params.includeArchive);
  const topics = new Map<string, { scopes: Set<string>; files: Set<string> }>();

  for (const absPath of files) {
    const relPath = path.relative(params.workspaceDir, absPath).replace(/\\/g, "/");
    let content = "";
    try {
      content = await fs.readFile(absPath, "utf-8");
    } catch {
      continue;
    }
    const summary = firstSummaryLine(content);
    const scope = topLevelScope(relPath);
    for (const token of collectTopicTokens(relPath, summary)) {
      const existing = topics.get(token) ?? { scopes: new Set<string>(), files: new Set<string>() };
      existing.scopes.add(scope);
      existing.files.add(relPath);
      topics.set(token, existing);
    }
  }

  const ranked = Array.from(topics.entries())
    .filter(([, stats]) => stats.scopes.size >= 2)
    .toSorted((a, b) => {
      const scopeDelta = b[1].scopes.size - a[1].scopes.size;
      if (scopeDelta !== 0) {
        return scopeDelta;
      }
      const fileDelta = b[1].files.size - a[1].files.size;
      if (fileDelta !== 0) {
        return fileDelta;
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, CROSS_REF_MAX_ITEMS);

  return ranked.map(([token, stats]) => {
    const filesForTopic = Array.from(stats.files)
      .toSorted((a, b) => a.localeCompare(b))
      .slice(0, CROSS_REF_MAX_FILES_PER_TOPIC)
      .map((relPath) => relPath.replace(/^memory\//, ""));
    const hidden = stats.files.size - filesForTopic.length;
    const suffix = hidden > 0 ? ` (+${hidden} more)` : "";
    return `- ${token}: ${filesForTopic.join("; ")}${suffix}`;
  });
}

async function buildDirAbstract(params: {
  dir: string;
  workspaceDir: string;
  includeArchive: boolean;
}): Promise<string> {
  let entries: Dirent[] = [];
  try {
    entries = await fs.readdir(params.dir, { withFileTypes: true });
  } catch {
    entries = [];
  }

  const relDir = path.relative(params.workspaceDir, params.dir).replace(/\\/g, "/");
  const subdirs = entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .toSorted((a, b) => a.localeCompare(b));

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name !== ABSTRACT_FILENAME && isIndexableMemoryFile(name))
    .toSorted((a, b) => a.localeCompare(b));

  const fileLines: string[] = [];
  for (const name of files) {
    const absPath = path.join(params.dir, name);
    const relPath = path.relative(params.workspaceDir, absPath).replace(/\\/g, "/");
    try {
      fileLines.push(await describeFile(absPath, relPath));
    } catch {
      fileLines.push(`- [L2|NONE] ${name}: (unreadable)`);
    }
  }

  const isRootMemoryDir = relDir === "memory";
  const crossRefs = isRootMemoryDir
    ? await buildRootCrossReferences({
        workspaceDir: params.workspaceDir,
        memoryRootDir: params.dir,
        includeArchive: params.includeArchive,
      })
    : [];

  const lines = [
    "# Memory Abstract",
    "",
    `Directory: ${relDir || "memory"}`,
    "",
    "## Children",
    ...subdirs.map((dir) => `- ${dir}/`),
    ...(subdirs.length === 0 ? ["- (none)"] : []),
    "",
    "## Files",
    ...fileLines,
    ...(fileLines.length === 0 ? ["- (none)"] : []),
    ...(isRootMemoryDir
      ? ["", "## Cross-References", ...crossRefs, ...(crossRefs.length === 0 ? ["- (none)"] : [])]
      : []),
    "",
    "## Retrieval Hint",
    "Use this directory index first (L0), then drill into L1/L2 files only when necessary.",
    "",
  ];
  return lines.join("\n");
}

export async function rebuildMemoryAbstracts(params: {
  workspaceDir: string;
  includeArchive?: boolean;
}): Promise<MemoryAbstractRebuildResult> {
  const memoryRoot = path.join(params.workspaceDir, "memory");
  try {
    const stat = await fs.stat(memoryRoot);
    if (!stat.isDirectory()) {
      return { scannedDirs: 0, written: [] };
    }
  } catch {
    return { scannedDirs: 0, written: [] };
  }

  const dirs = await collectDirs(memoryRoot, Boolean(params.includeArchive));
  const written: string[] = [];
  for (const dir of dirs) {
    const abstractPath = path.join(dir, ABSTRACT_FILENAME);
    const content = await buildDirAbstract({
      dir,
      workspaceDir: params.workspaceDir,
      includeArchive: Boolean(params.includeArchive),
    });
    let prev = "";
    try {
      prev = await fs.readFile(abstractPath, "utf-8");
    } catch {}
    if (prev === content) {
      continue;
    }
    await fs.writeFile(abstractPath, content, "utf-8");
    written.push(abstractPath);
  }

  return { scannedDirs: dirs.length, written };
}
