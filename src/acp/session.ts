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

import { randomUUID } from "node:crypto";

import type { AcpSession } from "./types.js";

export type AcpSessionStore = {
  createSession: (params: { sessionKey: string; cwd: string; sessionId?: string }) => AcpSession;
  getSession: (sessionId: string) => AcpSession | undefined;
  getSessionByRunId: (runId: string) => AcpSession | undefined;
  setActiveRun: (sessionId: string, runId: string, abortController: AbortController) => void;
  clearActiveRun: (sessionId: string) => void;
  cancelActiveRun: (sessionId: string) => boolean;
  clearAllSessionsForTest: () => void;
};

export function createInMemorySessionStore(): AcpSessionStore {
  const sessions = new Map<string, AcpSession>();
  const runIdToSessionId = new Map<string, string>();

  const createSession: AcpSessionStore["createSession"] = (params) => {
    const sessionId = params.sessionId ?? randomUUID();
    const session: AcpSession = {
      sessionId,
      sessionKey: params.sessionKey,
      cwd: params.cwd,
      createdAt: Date.now(),
      abortController: null,
      activeRunId: null,
    };
    sessions.set(sessionId, session);
    return session;
  };

  const getSession: AcpSessionStore["getSession"] = (sessionId) => sessions.get(sessionId);

  const getSessionByRunId: AcpSessionStore["getSessionByRunId"] = (runId) => {
    const sessionId = runIdToSessionId.get(runId);
    return sessionId ? sessions.get(sessionId) : undefined;
  };

  const setActiveRun: AcpSessionStore["setActiveRun"] = (sessionId, runId, abortController) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.activeRunId = runId;
    session.abortController = abortController;
    runIdToSessionId.set(runId, sessionId);
  };

  const clearActiveRun: AcpSessionStore["clearActiveRun"] = (sessionId) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.activeRunId) {
      runIdToSessionId.delete(session.activeRunId);
    }
    session.activeRunId = null;
    session.abortController = null;
  };

  const cancelActiveRun: AcpSessionStore["cancelActiveRun"] = (sessionId) => {
    const session = sessions.get(sessionId);
    if (!session?.abortController) {
      return false;
    }
    session.abortController.abort();
    if (session.activeRunId) {
      runIdToSessionId.delete(session.activeRunId);
    }
    session.abortController = null;
    session.activeRunId = null;
    return true;
  };

  const clearAllSessionsForTest: AcpSessionStore["clearAllSessionsForTest"] = () => {
    for (const session of sessions.values()) {
      session.abortController?.abort();
    }
    sessions.clear();
    runIdToSessionId.clear();
  };

  return {
    createSession,
    getSession,
    getSessionByRunId,
    setActiveRun,
    clearActiveRun,
    cancelActiveRun,
    clearAllSessionsForTest,
  };
}

export const defaultAcpSessionStore = createInMemorySessionStore();
