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

import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "../config/paths.js";
import type { AgentEventPayload } from "../infra/agent-events.js";

export type TraceRunMeta = {
  runId: string;
  sessionKey?: string;
  createdAtMs: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
  lastEventAtMs: number;
  status: "running" | "ended";
  streams: Record<string, number>;
  toolCalls: number;
  toolErrors: number;
};

export type TraceRunEvent = {
  type: "agent";
  runId: string;
  /**
   * When a chat run has a client runId that differs from the source agent runId
   * (rare, but possible), we store the original agent runId here.
   */
  sourceRunId?: string;
  clientRunId?: string;
  sessionKey?: string;
  seq: number;
  stream: string;
  ts: number;
  data: Record<string, unknown>;
};

type MetaState = {
  meta: TraceRunMeta;
  dirty: boolean;
  flushTimer: NodeJS.Timeout | null;
};

const metaByRun = new Map<string, MetaState>();

function sanitizeRunId(runId: string): string {
  const trimmed = runId.trim();
  if (!trimmed) {
    return "run";
  }
  // Prevent path traversal and keep filenames predictable.
  return trimmed.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveTraceRunsDir(): string {
  return path.join(resolveStateDir(), "trace", "runs");
}

function resolveRunPaths(runIdRaw: string) {
  const runId = sanitizeRunId(runIdRaw);
  const dir = resolveTraceRunsDir();
  return {
    runId,
    dir,
    events: path.join(dir, `${runId}.jsonl`),
    meta: path.join(dir, `${runId}.meta.json`),
  };
}

function ensureTraceDir() {
  const dir = resolveTraceRunsDir();
  if (fs.existsSync(dir)) {
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
}

function getOrInitMeta(runId: string): MetaState {
  const existing = metaByRun.get(runId);
  if (existing) {
    return existing;
  }
  const now = Date.now();
  const meta: TraceRunMeta = {
    runId,
    createdAtMs: now,
    startedAtMs: null,
    endedAtMs: null,
    lastEventAtMs: now,
    status: "running",
    streams: {},
    toolCalls: 0,
    toolErrors: 0,
  };
  const state: MetaState = { meta, dirty: true, flushTimer: null };
  metaByRun.set(runId, state);
  return state;
}

function scheduleMetaFlush(runId: string) {
  const state = metaByRun.get(runId);
  if (!state) {
    return;
  }
  if (state.flushTimer) {
    return;
  }
  state.flushTimer = setTimeout(() => {
    state.flushTimer = null;
    void flushMeta(runId);
  }, 200);
}

async function flushMeta(runId: string) {
  const state = metaByRun.get(runId);
  if (!state || !state.dirty) {
    return;
  }
  state.dirty = false;
  ensureTraceDir();
  const { meta: metaPath } = resolveRunPaths(runId);
  await fs.promises.writeFile(metaPath, JSON.stringify(state.meta, null, 2), "utf8");
}

function applyMetaFromAgentEvent(meta: TraceRunMeta, evt: TraceRunEvent) {
  meta.lastEventAtMs = evt.ts;
  meta.streams[evt.stream] = (meta.streams[evt.stream] ?? 0) + 1;
  if (evt.sessionKey && !meta.sessionKey) {
    meta.sessionKey = evt.sessionKey;
  }

  if (evt.stream === "lifecycle") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "";
    if (phase === "start") {
      const startedAt = typeof evt.data?.startedAt === "number" ? evt.data.startedAt : evt.ts;
      meta.startedAtMs = meta.startedAtMs ?? startedAt;
      meta.endedAtMs = null;
      meta.status = "running";
    }
    if (phase === "end" || phase === "error") {
      const endedAt = typeof evt.data?.endedAt === "number" ? evt.data.endedAt : evt.ts;
      meta.endedAtMs = endedAt;
      meta.status = "ended";
    }
  }

  if (evt.stream === "tool") {
    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "";
    if (phase === "start") {
      meta.toolCalls += 1;
    }
    if (phase === "result") {
      const isError = Boolean(evt.data?.isError);
      if (isError) {
        meta.toolErrors += 1;
      }
    }
  }
}

export async function recordTraceAgentEvent(params: {
  runId: string;
  evt: AgentEventPayload;
  sourceRunId?: string;
  clientRunId?: string;
  sessionKey?: string;
}) {
  const runId = params.runId.trim();
  if (!runId) {
    return;
  }
  ensureTraceDir();
  const paths = resolveRunPaths(runId);

  const sessionKey = params.sessionKey ?? params.evt.sessionKey;
  const entry: TraceRunEvent = {
    type: "agent",
    runId: paths.runId,
    sourceRunId: params.sourceRunId,
    clientRunId: params.clientRunId,
    sessionKey,
    seq: params.evt.seq,
    stream: params.evt.stream,
    ts: params.evt.ts,
    data: params.evt.data,
  };

  const metaState = getOrInitMeta(paths.runId);
  applyMetaFromAgentEvent(metaState.meta, entry);
  metaState.dirty = true;
  scheduleMetaFlush(paths.runId);

  await fs.promises.appendFile(paths.events, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function listTraceRuns(params?: { limit?: number }): Promise<TraceRunMeta[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(params?.limit ?? 50)));
  ensureTraceDir();
  const dir = resolveTraceRunsDir();
  const entries = await fs.promises.readdir(dir).catch(() => []);
  const metas = entries.filter((name) => name.endsWith(".meta.json"));
  const loaded: TraceRunMeta[] = [];
  for (const filename of metas) {
    const full = path.join(dir, filename);
    try {
      const raw = await fs.promises.readFile(full, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        continue;
      }
      const meta = parsed as TraceRunMeta;
      if (typeof meta.runId !== "string" || !meta.runId) {
        continue;
      }
      loaded.push(meta);
    } catch {
      // ignore
    }
  }
  loaded.sort((a, b) => (b.lastEventAtMs ?? 0) - (a.lastEventAtMs ?? 0));
  return loaded.slice(0, limit);
}

export async function getTraceRunEvents(params: {
  runId: string;
  limit?: number;
}): Promise<{ runId: string; events: TraceRunEvent[]; truncated: boolean }> {
  const runId = sanitizeRunId(params.runId);
  const limit = Math.max(1, Math.min(20000, Math.floor(params.limit ?? 5000)));
  ensureTraceDir();
  const { events: eventsPath } = resolveRunPaths(runId);
  const raw = await fs.promises.readFile(eventsPath, "utf8").catch(() => "");
  const lines = raw.split("\n").filter(Boolean);
  const truncated = lines.length > limit;
  const slice = truncated ? lines.slice(-limit) : lines;
  const events: TraceRunEvent[] = [];
  for (const line of slice) {
    try {
      const parsed = JSON.parse(line) as unknown;
      if (!parsed || typeof parsed !== "object") {
        continue;
      }
      const evt = parsed as TraceRunEvent;
      if (evt.type !== "agent") {
        continue;
      }
      events.push(evt);
    } catch {
      // ignore malformed line
    }
  }
  return { runId, events, truncated };
}

export function __resetTraceMetaCacheForTest() {
  for (const state of metaByRun.values()) {
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
    }
  }
  metaByRun.clear();
}
