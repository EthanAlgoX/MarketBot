import fs from "node:fs/promises";
import path from "node:path";

import { resolveSessionPath, resolveSessionsDir, resolveSessionsIndexPath, resolveStateDir } from "./paths.js";
import { normalizeSessionKey, sessionIdFromKey } from "./sessionKey.js";
import type { SessionEntry, SessionIndex, SessionIndexEntry } from "./types.js";

export interface SessionStoreOptions {
  stateDir?: string;
  agentId?: string;
  maxEntries?: number;
  maxEntryChars?: number;
  contextMaxChars?: number;
}

export class SessionStore {
  private stateDir: string;
  private agentId: string;
  private maxEntries: number;
  private maxEntryChars: number;
  private contextMaxChars: number;

  constructor(options: SessionStoreOptions = {}) {
    this.stateDir = options.stateDir ?? resolveStateDir();
    this.agentId = options.agentId?.trim() || "main";
    this.maxEntries = clampNumber(options.maxEntries, 20);
    this.maxEntryChars = clampNumber(options.maxEntryChars, 2000);
    this.contextMaxChars = clampNumber(options.contextMaxChars, 6000);
  }

  async append(sessionKey: string, entries: SessionEntry | SessionEntry[], summary?: string): Promise<void> {
    const normalizedKey = normalizeSessionKey(sessionKey);
    const sessionId = sessionIdFromKey(normalizedKey);
    const sessionsDir = resolveSessionsDir(this.stateDir, this.agentId);
    const sessionPath = resolveSessionPath(sessionsDir, sessionId);

    await fs.mkdir(sessionsDir, { recursive: true });

    const payload = Array.isArray(entries) ? entries : [entries];
    const normalized = payload.map((entry) => normalizeEntry(entry, this.maxEntryChars));
    const lines = normalized.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
    await fs.appendFile(sessionPath, lines, "utf8");

    await this.updateIndex(normalizedKey, sessionId, summary ?? deriveSummary(normalized));
    await this.maybeCompact(normalizedKey, sessionId, sessionsDir, sessionPath);
  }

  async loadRecent(sessionKey: string): Promise<SessionEntry[]> {
    const normalizedKey = normalizeSessionKey(sessionKey);
    const sessionId = sessionIdFromKey(normalizedKey);
    const sessionsDir = resolveSessionsDir(this.stateDir, this.agentId);
    const sessionPath = resolveSessionPath(sessionsDir, sessionId);

    const entries = await readEntries(sessionPath);
    return trimEntries(entries, this.maxEntries, this.contextMaxChars);
  }

  async buildContext(sessionKey: string): Promise<string> {
    const entries = await this.loadRecent(sessionKey);
    if (entries.length === 0) return "";

    const lines: string[] = [];
    lines.push("## Session Context");
    for (const entry of entries) {
      const label = entry.type.padEnd(9, " ");
      lines.push(`[${entry.ts}] ${label} ${entry.content}`);
    }
    return lines.join("\n");
  }

  private async updateIndex(sessionKey: string, sessionId: string, summary?: string) {
    const sessionsDir = resolveSessionsDir(this.stateDir, this.agentId);
    const indexPath = resolveSessionsIndexPath(sessionsDir);
    const index = await readIndex(indexPath);

    const now = new Date().toISOString();
    const entry: SessionIndexEntry = {
      sessionId,
      updatedAt: now,
      summary: summary?.trim() || index[sessionKey]?.summary,
    };

    index[sessionKey] = entry;
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
  }

  private async maybeCompact(
    sessionKey: string,
    sessionId: string,
    sessionsDir: string,
    sessionPath: string,
  ): Promise<void> {
    const entries = await readEntries(sessionPath);
    if (entries.length <= this.maxEntries) return;

    const keep = entries.slice(-this.maxEntries);
    const dropped = entries.length - keep.length;
    const compacted: SessionEntry = {
      ts: new Date().toISOString(),
      type: "compaction",
      content: `Compacted ${dropped} entries to keep recent context.`,
    };

    const next = [compacted, ...keep];
    const lines = next.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(sessionPath, lines, "utf8");
    await this.updateIndex(sessionKey, sessionId, compacted.content);
  }
}

function clampNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value <= 0) return fallback;
  return Math.floor(value);
}

function normalizeEntry(entry: SessionEntry, maxChars: number): SessionEntry {
  const ts = entry.ts && entry.ts.trim() ? entry.ts : new Date().toISOString();
  const content = entry.content?.trim() ?? "";
  const trimmed = content.length > maxChars ? `${content.slice(0, maxChars)}…` : content;
  return { ...entry, ts, content: trimmed };
}

function deriveSummary(entries: SessionEntry[]): string | undefined {
  const summaryEntry = entries.find((entry) => entry.type === "summary");
  if (summaryEntry?.content) return summaryEntry.content.slice(0, 200);
  return undefined;
}

async function readEntries(sessionPath: string): Promise<SessionEntry[]> {
  try {
    const raw = await fs.readFile(sessionPath, "utf8");
    const entries: SessionEntry[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as SessionEntry;
        if (parsed && typeof parsed === "object" && typeof parsed.content === "string") {
          entries.push(parsed);
        }
      } catch {
        continue;
      }
    }
    return entries;
  } catch {
    return [];
  }
}

async function readIndex(indexPath: string): Promise<SessionIndex> {
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as SessionIndex;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function trimEntries(entries: SessionEntry[], maxEntries: number, maxChars: number): SessionEntry[] {
  let trimmed = entries.slice(-maxEntries);
  if (maxChars <= 0) return trimmed;

  const result: SessionEntry[] = [];
  let total = 0;
  for (let i = trimmed.length - 1; i >= 0; i -= 1) {
    const entry = trimmed[i];
    const size = entry.content.length;
    if (total + size > maxChars) break;
    result.unshift(entry);
    total += size;
  }
  return result;
}
