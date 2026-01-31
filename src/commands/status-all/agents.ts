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
import { resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import type { MarketBotConfig } from "../../config/config.js";
import { loadSessionStore, resolveStorePath } from "../../config/sessions.js";
import { listAgentsForGateway } from "../../gateway/session-utils.js";

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function getAgentLocalStatuses(cfg: MarketBotConfig) {
  const agentList = listAgentsForGateway(cfg);
  const now = Date.now();

  const agents = await Promise.all(
    agentList.agents.map(async (agent) => {
      const workspaceDir = (() => {
        try {
          return resolveAgentWorkspaceDir(cfg, agent.id);
        } catch {
          return null;
        }
      })();
      const bootstrapPending =
        workspaceDir != null ? await fileExists(path.join(workspaceDir, "BOOTSTRAP.md")) : null;
      const sessionsPath = resolveStorePath(cfg.session?.store, {
        agentId: agent.id,
      });
      const store = (() => {
        try {
          return loadSessionStore(sessionsPath);
        } catch {
          return {};
        }
      })();
      const updatedAt = Object.values(store).reduce(
        (max, entry) => Math.max(max, entry?.updatedAt ?? 0),
        0,
      );
      const lastUpdatedAt = updatedAt > 0 ? updatedAt : null;
      const lastActiveAgeMs = lastUpdatedAt ? now - lastUpdatedAt : null;
      const sessionsCount = Object.keys(store).filter(
        (k) => k !== "global" && k !== "unknown",
      ).length;
      return {
        id: agent.id,
        name: agent.name,
        workspaceDir,
        bootstrapPending,
        sessionsPath,
        sessionsCount,
        lastUpdatedAt,
        lastActiveAgeMs,
      };
    }),
  );

  const totalSessions = agents.reduce((sum, a) => sum + a.sessionsCount, 0);
  const bootstrapPendingCount = agents.reduce((sum, a) => sum + (a.bootstrapPending ? 1 : 0), 0);
  return {
    defaultId: agentList.defaultId,
    agents,
    totalSessions,
    bootstrapPendingCount,
  };
}
