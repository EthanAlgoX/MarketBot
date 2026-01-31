export type SessionEntryType = "user" | "summary" | "report" | "system" | "compaction";

export interface SessionEntry {
  ts: string;
  type: SessionEntryType;
  content: string;
  meta?: Record<string, unknown>;
}

export interface SessionIndexEntry {
  sessionId: string;
  updatedAt: string;
  summary?: string;
}

export type SessionIndex = Record<string, SessionIndexEntry>;
