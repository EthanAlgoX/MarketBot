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

import type { DatabaseSync } from "node:sqlite";

import { truncateUtf16Safe } from "../utils.js";
import { cosineSimilarity, parseEmbedding } from "./internal.js";
import type { MemoryLayer, MemoryPriority } from "./memory-meta.js";

const vectorToBlob = (embedding: number[]): Buffer =>
  Buffer.from(new Float32Array(embedding).buffer);

export type SearchSource = string;

export type SearchRowResult = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: SearchSource;
  layer: MemoryLayer;
  priority: MemoryPriority;
  expiresAt: number | null;
};

function isMissingMetaColumnError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /no such column: .*?(layer|priority|expires_at)/i.test(message);
}

function filterByLayerAndExpiry<T extends { layer: MemoryLayer; expiresAt: number | null }>(
  rows: T[],
  layers: MemoryLayer[],
  includeExpired: boolean,
  nowMs: number,
): T[] {
  const allowed = new Set(layers);
  return rows.filter((row) => {
    if (!allowed.has(row.layer)) {
      return false;
    }
    if (includeExpired) {
      return true;
    }
    return row.expiresAt == null || row.expiresAt > nowMs;
  });
}

export async function searchVector(params: {
  db: DatabaseSync;
  vectorTable: string;
  providerModel: string;
  queryVec: number[];
  limit: number;
  snippetMaxChars: number;
  ensureVectorReady: (dimensions: number) => Promise<boolean>;
  sourceFilterVec: { sql: string; params: SearchSource[] };
  sourceFilterChunks: { sql: string; params: SearchSource[] };
  layerFilter: { sql: string; params: MemoryLayer[] };
  includeExpired: boolean;
  nowMs: number;
}): Promise<SearchRowResult[]> {
  if (params.queryVec.length === 0 || params.limit <= 0) {
    return [];
  }
  if (await params.ensureVectorReady(params.queryVec.length)) {
    try {
      const rows = params.db
        .prepare(
          `SELECT c.id, c.path, c.start_line, c.end_line, c.text,\n` +
            `       c.source, c.layer, c.priority, c.expires_at,\n` +
            `       vec_distance_cosine(v.embedding, ?) AS dist\n` +
            `  FROM ${params.vectorTable} v\n` +
            `  JOIN chunks c ON c.id = v.id\n` +
            ` WHERE c.model = ?${params.sourceFilterVec.sql}${params.layerFilter.sql}` +
            `${params.includeExpired ? "" : ` AND (c.expires_at IS NULL OR c.expires_at > ?)`}\n` +
            ` ORDER BY dist ASC\n` +
            ` LIMIT ?`,
        )
        .all(
          vectorToBlob(params.queryVec),
          params.providerModel,
          ...params.sourceFilterVec.params,
          ...params.layerFilter.params,
          ...(params.includeExpired ? [] : [params.nowMs]),
          params.limit,
        ) as Array<{
        id: string;
        path: string;
        start_line: number;
        end_line: number;
        text: string;
        source: SearchSource;
        layer: MemoryLayer;
        priority: MemoryPriority;
        expires_at: number | null;
        dist: number;
      }>;
      return rows.map((row) => ({
        id: row.id,
        path: row.path,
        startLine: row.start_line,
        endLine: row.end_line,
        score: 1 - row.dist,
        snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
        source: row.source,
        layer: row.layer,
        priority: row.priority,
        expiresAt: row.expires_at,
      }));
    } catch (err) {
      if (!isMissingMetaColumnError(err)) {
        throw err;
      }
      const rows = params.db
        .prepare(
          `SELECT c.id, c.path, c.start_line, c.end_line, c.text,\n` +
            `       c.source,\n` +
            `       vec_distance_cosine(v.embedding, ?) AS dist\n` +
            `  FROM ${params.vectorTable} v\n` +
            `  JOIN chunks c ON c.id = v.id\n` +
            ` WHERE c.model = ?${params.sourceFilterVec.sql}\n` +
            ` ORDER BY dist ASC\n` +
            ` LIMIT ?`,
        )
        .all(
          vectorToBlob(params.queryVec),
          params.providerModel,
          ...params.sourceFilterVec.params,
          params.limit,
        ) as Array<{
        id: string;
        path: string;
        start_line: number;
        end_line: number;
        text: string;
        source: SearchSource;
        dist: number;
      }>;
      return filterByLayerAndExpiry(
        rows.map((row) => ({
          id: row.id,
          path: row.path,
          startLine: row.start_line,
          endLine: row.end_line,
          score: 1 - row.dist,
          snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
          source: row.source,
          layer: "l2" as const,
          priority: "none" as const,
          expiresAt: null,
        })),
        params.layerFilter.params,
        params.includeExpired,
        params.nowMs,
      );
    }
  }

  const candidates = listChunks({
    db: params.db,
    providerModel: params.providerModel,
    sourceFilter: params.sourceFilterChunks,
    layerFilter: params.layerFilter,
    includeExpired: params.includeExpired,
    nowMs: params.nowMs,
  });
  const scored = candidates
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(params.queryVec, chunk.embedding),
    }))
    .filter((entry) => Number.isFinite(entry.score));
  return scored
    .toSorted((a, b) => b.score - a.score)
    .slice(0, params.limit)
    .map((entry) => ({
      id: entry.chunk.id,
      path: entry.chunk.path,
      startLine: entry.chunk.startLine,
      endLine: entry.chunk.endLine,
      score: entry.score,
      snippet: truncateUtf16Safe(entry.chunk.text, params.snippetMaxChars),
      source: entry.chunk.source,
      layer: entry.chunk.layer,
      priority: entry.chunk.priority,
      expiresAt: entry.chunk.expiresAt,
    }));
}

export function listChunks(params: {
  db: DatabaseSync;
  providerModel: string;
  sourceFilter: { sql: string; params: SearchSource[] };
  layerFilter: { sql: string; params: MemoryLayer[] };
  includeExpired: boolean;
  nowMs: number;
}): Array<{
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  embedding: number[];
  source: SearchSource;
  layer: MemoryLayer;
  priority: MemoryPriority;
  expiresAt: number | null;
}> {
  try {
    const rows = params.db
      .prepare(
        `SELECT id, path, start_line, end_line, text, embedding, source, layer, priority, expires_at\n` +
          `  FROM chunks\n` +
          ` WHERE model = ?${params.sourceFilter.sql}${params.layerFilter.sql}` +
          `${params.includeExpired ? "" : ` AND (expires_at IS NULL OR expires_at > ?)`}`,
      )
      .all(
        params.providerModel,
        ...params.sourceFilter.params,
        ...params.layerFilter.params,
        ...(params.includeExpired ? [] : [params.nowMs]),
      ) as Array<{
      id: string;
      path: string;
      start_line: number;
      end_line: number;
      text: string;
      embedding: string;
      source: SearchSource;
      layer: MemoryLayer;
      priority: MemoryPriority;
      expires_at: number | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      startLine: row.start_line,
      endLine: row.end_line,
      text: row.text,
      embedding: parseEmbedding(row.embedding),
      source: row.source,
      layer: row.layer,
      priority: row.priority,
      expiresAt: row.expires_at,
    }));
  } catch (err) {
    if (!isMissingMetaColumnError(err)) {
      throw err;
    }
    const rows = params.db
      .prepare(
        `SELECT id, path, start_line, end_line, text, embedding, source\n` +
          `  FROM chunks\n` +
          ` WHERE model = ?${params.sourceFilter.sql}`,
      )
      .all(params.providerModel, ...params.sourceFilter.params) as Array<{
      id: string;
      path: string;
      start_line: number;
      end_line: number;
      text: string;
      embedding: string;
      source: SearchSource;
    }>;

    return filterByLayerAndExpiry(
      rows.map((row) => ({
        id: row.id,
        path: row.path,
        startLine: row.start_line,
        endLine: row.end_line,
        text: row.text,
        embedding: parseEmbedding(row.embedding),
        source: row.source,
        layer: "l2" as const,
        priority: "none" as const,
        expiresAt: null,
      })),
      params.layerFilter.params,
      params.includeExpired,
      params.nowMs,
    );
  }
}

export async function searchKeyword(params: {
  db: DatabaseSync;
  ftsTable: string;
  providerModel: string;
  query: string;
  limit: number;
  snippetMaxChars: number;
  sourceFilter: { sql: string; params: SearchSource[] };
  layerFilter: { sql: string; params: MemoryLayer[] };
  includeExpired: boolean;
  nowMs: number;
  buildFtsQuery: (raw: string) => string | null;
  bm25RankToScore: (rank: number) => number;
}): Promise<Array<SearchRowResult & { textScore: number }>> {
  if (params.limit <= 0) {
    return [];
  }
  const ftsQuery = params.buildFtsQuery(params.query);
  if (!ftsQuery) {
    return [];
  }

  try {
    const rows = params.db
      .prepare(
        `SELECT id, path, source, layer, priority, expires_at, start_line, end_line, text,\n` +
          `       bm25(${params.ftsTable}) AS rank\n` +
          `  FROM ${params.ftsTable}\n` +
          ` WHERE ${params.ftsTable} MATCH ? AND model = ?${params.sourceFilter.sql}${params.layerFilter.sql}` +
          `${params.includeExpired ? "" : ` AND (expires_at IS NULL OR expires_at > ?)`}\n` +
          ` ORDER BY rank ASC\n` +
          ` LIMIT ?`,
      )
      .all(
        ftsQuery,
        params.providerModel,
        ...params.sourceFilter.params,
        ...params.layerFilter.params,
        ...(params.includeExpired ? [] : [params.nowMs]),
        params.limit,
      ) as Array<{
      id: string;
      path: string;
      source: SearchSource;
      layer: MemoryLayer;
      priority: MemoryPriority;
      expires_at: number | null;
      start_line: number;
      end_line: number;
      text: string;
      rank: number;
    }>;

    return rows.map((row) => {
      const textScore = params.bm25RankToScore(row.rank);
      return {
        id: row.id,
        path: row.path,
        startLine: row.start_line,
        endLine: row.end_line,
        score: textScore,
        textScore,
        snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
        source: row.source,
        layer: row.layer,
        priority: row.priority,
        expiresAt: row.expires_at,
      };
    });
  } catch (err) {
    if (!isMissingMetaColumnError(err)) {
      throw err;
    }
    const rows = params.db
      .prepare(
        `SELECT id, path, source, start_line, end_line, text,\n` +
          `       bm25(${params.ftsTable}) AS rank\n` +
          `  FROM ${params.ftsTable}\n` +
          ` WHERE ${params.ftsTable} MATCH ? AND model = ?${params.sourceFilter.sql}\n` +
          ` ORDER BY rank ASC\n` +
          ` LIMIT ?`,
      )
      .all(ftsQuery, params.providerModel, ...params.sourceFilter.params, params.limit) as Array<{
      id: string;
      path: string;
      source: SearchSource;
      start_line: number;
      end_line: number;
      text: string;
      rank: number;
    }>;
    const normalized = rows.map((row) => {
      const textScore = params.bm25RankToScore(row.rank);
      return {
        id: row.id,
        path: row.path,
        startLine: row.start_line,
        endLine: row.end_line,
        score: textScore,
        textScore,
        snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
        source: row.source,
        layer: "l2" as const,
        priority: "none" as const,
        expiresAt: null,
      };
    });
    return filterByLayerAndExpiry(
      normalized,
      params.layerFilter.params,
      params.includeExpired,
      params.nowMs,
    );
  }
}
