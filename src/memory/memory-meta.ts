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

import path from "node:path";

export type MemoryLayer = "l0" | "l1" | "l2";
export type MemoryPriority = "p0" | "p1" | "p2" | "none";

export const MEMORY_LAYERS: MemoryLayer[] = ["l0", "l1", "l2"];
const LAYER_ORDER = new Map<MemoryLayer, number>([
  ["l0", 0],
  ["l1", 1],
  ["l2", 2],
]);

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
const PRIORITY_TAG_RE = /(?:\[(p[012])\]|(?:^|\s)#(p[012])\b)/gi;
const FRONTMATTER_LAYER_RE = /(?:^|\n)\s*layer\s*:\s*(l[0-2])\b/i;
const FRONTMATTER_PRIORITY_RE = /(?:^|\n)\s*(?:priority|lifecycle|ttlClass)\s*:\s*(p[012])\b/i;

export function normalizeMemoryLayer(value: unknown): MemoryLayer | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "l0" || normalized === "l1" || normalized === "l2") {
    return normalized;
  }
  return null;
}

export function normalizeMemoryPriority(value: unknown): MemoryPriority | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "p0" || normalized === "p1" || normalized === "p2") {
    return normalized;
  }
  return null;
}

function readFrontmatter(content: string): string | null {
  const match = content.match(FRONTMATTER_RE);
  return match?.[1] ?? null;
}

function layerFromFrontmatter(content: string): MemoryLayer | null {
  const frontmatter = readFrontmatter(content);
  if (!frontmatter) {
    return null;
  }
  return normalizeMemoryLayer(frontmatter.match(FRONTMATTER_LAYER_RE)?.[1] ?? null);
}

function priorityFromFrontmatter(content: string): MemoryPriority | null {
  const frontmatter = readFrontmatter(content);
  if (!frontmatter) {
    return null;
  }
  return normalizeMemoryPriority(frontmatter.match(FRONTMATTER_PRIORITY_RE)?.[1] ?? null);
}

function priorityFromTags(content: string): MemoryPriority | null {
  for (const match of content.matchAll(PRIORITY_TAG_RE)) {
    const raw = match[1] ?? match[2];
    const normalized = normalizeMemoryPriority(raw);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function basenameOf(relPath: string): string {
  return path.basename(relPath).toLowerCase();
}

function normalizedRelPath(relPath: string): string {
  return relPath.replace(/\\/g, "/").toLowerCase();
}

export function resolveMemoryLayer(params: {
  source: "memory" | "sessions";
  relPath: string;
  content?: string;
}): MemoryLayer {
  if (params.source === "sessions") {
    return "l2";
  }
  const contentLayer = params.content ? layerFromFrontmatter(params.content) : null;
  if (contentLayer) {
    return contentLayer;
  }
  const rel = normalizedRelPath(params.relPath);
  const base = basenameOf(rel);
  if (base === ".abstract" || rel.endsWith("/.abstract") || base === "session-state.md") {
    return "l0";
  }
  if (
    base === "memory.md" ||
    rel.endsWith("/memory.md") ||
    rel.includes("/insights/") ||
    rel.includes("/lessons/")
  ) {
    return "l1";
  }
  return "l2";
}

export function resolveMemoryPriority(params: {
  source: "memory" | "sessions";
  relPath: string;
  layer: MemoryLayer;
  content?: string;
}): MemoryPriority {
  if (params.source === "sessions") {
    return "p2";
  }
  const fromFrontmatter = params.content ? priorityFromFrontmatter(params.content) : null;
  if (fromFrontmatter) {
    return fromFrontmatter;
  }
  const fromTag = params.content ? priorityFromTags(params.content) : null;
  if (fromTag) {
    return fromTag;
  }
  const rel = normalizedRelPath(params.relPath);
  const base = basenameOf(rel);
  if (base === ".abstract" || base === "session-state.md" || base === "memory.md") {
    return "p0";
  }
  if (rel.includes("/insights/") || rel.includes("/lessons/")) {
    return "p1";
  }
  if (/\b\d{4}-\d{2}-\d{2}\.(md|mdx|jsonl)\b/.test(base)) {
    return "p2";
  }
  if (params.layer === "l0") {
    return "p0";
  }
  return "none";
}

export function resolvePriorityExpiryMs(params: {
  priority: MemoryPriority;
  referenceMs: number;
  p1Days: number;
  p2Days: number;
}): number | null {
  if (params.priority === "p0" || params.priority === "none") {
    return null;
  }
  const days = params.priority === "p1" ? params.p1Days : params.p2Days;
  const normalizedDays = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
  return params.referenceMs + normalizedDays * 24 * 60 * 60 * 1000;
}

export function isExpired(
  expiresAt: number | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return false;
  }
  return expiresAt <= nowMs;
}

export function resolveLayerSelection(params: {
  depth?: MemoryLayer;
  maxDepth?: MemoryLayer;
}): MemoryLayer[] {
  if (!params.depth && !params.maxDepth) {
    return [...MEMORY_LAYERS];
  }
  if (params.depth && !params.maxDepth) {
    return [params.depth];
  }
  if (!params.depth && params.maxDepth) {
    const maxRank = LAYER_ORDER.get(params.maxDepth) ?? 2;
    return MEMORY_LAYERS.filter((layer) => (LAYER_ORDER.get(layer) ?? 2) <= maxRank);
  }
  const start = LAYER_ORDER.get(params.depth!) ?? 0;
  const end = LAYER_ORDER.get(params.maxDepth!) ?? 2;
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  return MEMORY_LAYERS.filter((layer) => {
    const rank = LAYER_ORDER.get(layer) ?? 2;
    return rank >= min && rank <= max;
  });
}
