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

import { createSubsystemLogger } from "../logging/subsystem.js";
import { buildFileEntry, listMemoryFiles, type MemoryFileEntry } from "./internal.js";

const log = createSubsystemLogger("memory");

type ProgressState = {
  completed: number;
  total: number;
  label?: string;
  report: (update: { completed: number; total: number; label?: string }) => void;
};

export async function syncMemoryFiles(params: {
  workspaceDir: string;
  extraPaths?: string[];
  db: DatabaseSync;
  needsFullReindex: boolean;
  progress?: ProgressState;
  batchEnabled: boolean;
  concurrency: number;
  runWithConcurrency: <T>(tasks: Array<() => Promise<T>>, concurrency: number) => Promise<T[]>;
  indexFile: (entry: MemoryFileEntry) => Promise<void>;
  vectorTable: string;
  ftsTable: string;
  ftsEnabled: boolean;
  ftsAvailable: boolean;
  model: string;
}) {
  const files = await listMemoryFiles(params.workspaceDir, params.extraPaths);
  const fileEntries = await Promise.all(
    files.map(async (file) => buildFileEntry(file, params.workspaceDir)),
  );

  log.debug("memory sync: indexing memory files", {
    files: fileEntries.length,
    needsFullReindex: params.needsFullReindex,
    batch: params.batchEnabled,
    concurrency: params.concurrency,
  });

  const activePaths = new Set(fileEntries.map((entry) => entry.path));
  if (params.progress) {
    params.progress.total += fileEntries.length;
    params.progress.report({
      completed: params.progress.completed,
      total: params.progress.total,
      label: params.batchEnabled ? "Indexing memory files (batch)..." : "Indexing memory files…",
    });
  }

  const tasks = fileEntries.map((entry) => async () => {
    const record = params.db
      .prepare(`SELECT hash FROM files WHERE path = ? AND source = ?`)
      .get(entry.path, "memory") as { hash: string } | undefined;
    if (!params.needsFullReindex && record?.hash === entry.hash) {
      if (params.progress) {
        params.progress.completed += 1;
        params.progress.report({
          completed: params.progress.completed,
          total: params.progress.total,
        });
      }
      return;
    }
    await params.indexFile(entry);
    if (params.progress) {
      params.progress.completed += 1;
      params.progress.report({
        completed: params.progress.completed,
        total: params.progress.total,
      });
    }
  });

  await params.runWithConcurrency(tasks, params.concurrency);

  const staleRows = params.db
    .prepare(`SELECT path FROM files WHERE source = ?`)
    .all("memory") as Array<{ path: string }>;
  for (const stale of staleRows) {
    if (activePaths.has(stale.path)) {
      continue;
    }
    params.db.prepare(`DELETE FROM files WHERE path = ? AND source = ?`).run(stale.path, "memory");
    try {
      params.db
        .prepare(
          `DELETE FROM ${params.vectorTable} WHERE id IN (SELECT id FROM chunks WHERE path = ? AND source = ?)`,
        )
        .run(stale.path, "memory");
    } catch {}
    params.db.prepare(`DELETE FROM chunks WHERE path = ? AND source = ?`).run(stale.path, "memory");
    if (params.ftsEnabled && params.ftsAvailable) {
      try {
        params.db
          .prepare(`DELETE FROM ${params.ftsTable} WHERE path = ? AND source = ? AND model = ?`)
          .run(stale.path, "memory", params.model);
      } catch {}
    }
  }
}
