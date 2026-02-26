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

import { Type } from "@sinclair/typebox";

import type { MarketBotConfig } from "../../config/config.js";
import { getMemorySearchManager } from "../../memory/index.js";
import { normalizeMemoryLayer } from "../../memory/memory-meta.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { resolveMemorySearchConfig } from "../memory-search.js";
import { optionalStringEnum } from "../schema/typebox.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

const MemorySearchSchema = Type.Object({
  query: Type.String(),
  maxResults: Type.Optional(Type.Number()),
  minScore: Type.Optional(Type.Number()),
  depth: optionalStringEnum(["l0", "l1", "l2"] as const),
  maxDepth: optionalStringEnum(["l0", "l1", "l2"] as const),
  includeExpired: Type.Optional(Type.Boolean()),
});

const MemoryGetSchema = Type.Object({
  path: Type.String(),
  from: Type.Optional(Type.Number()),
  lines: Type.Optional(Type.Number()),
});

export function createMemorySearchTool(options: {
  config?: MarketBotConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = options.config;
  if (!cfg) {
    return null;
  }
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  if (!resolveMemorySearchConfig(cfg, agentId)) {
    return null;
  }
  return {
    label: "Memory Search",
    name: "memory_search",
    description:
      "Mandatory recall step: search memory in layers (.abstract → summaries → raw logs). Use depth=l0 first, then expand to l1/l2 as needed. Returns top snippets with path + lines.",
    parameters: MemorySearchSchema,
    execute: async (_toolCallId, params) => {
      const query = readStringParam(params, "query", { required: true });
      const maxResults = readNumberParam(params, "maxResults");
      const minScore = readNumberParam(params, "minScore");
      const rawDepth = readStringParam(params, "depth");
      const rawMaxDepth = readStringParam(params, "maxDepth");
      const depth = rawDepth ? normalizeMemoryLayer(rawDepth) : null;
      const maxDepth = rawMaxDepth ? normalizeMemoryLayer(rawMaxDepth) : null;
      if (rawDepth && !depth) {
        return jsonResult({ results: [], disabled: true, error: "depth must be l0, l1, or l2" });
      }
      if (rawMaxDepth && !maxDepth) {
        return jsonResult({
          results: [],
          disabled: true,
          error: "maxDepth must be l0, l1, or l2",
        });
      }
      const includeExpired =
        typeof params.includeExpired === "boolean" ? params.includeExpired : undefined;
      const { manager, error } = await getMemorySearchManager({
        cfg,
        agentId,
      });
      if (!manager) {
        return jsonResult({ results: [], disabled: true, error });
      }
      try {
        const results = await manager.search(query, {
          maxResults,
          minScore,
          sessionKey: options.agentSessionKey,
          depth: depth ?? undefined,
          maxDepth: maxDepth ?? undefined,
          includeExpired,
        });
        const status = manager.status();
        return jsonResult({
          results,
          provider: status.provider,
          model: status.model,
          fallback: status.fallback,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ results: [], disabled: true, error: message });
      }
    },
  };
}

export function createMemoryGetTool(options: {
  config?: MarketBotConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = options.config;
  if (!cfg) {
    return null;
  }
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  if (!resolveMemorySearchConfig(cfg, agentId)) {
    return null;
  }
  return {
    label: "Memory Get",
    name: "memory_get",
    description:
      "Safe snippet read from memory files (.md/.mdx/.jsonl/.abstract) or configured memorySearch.extraPaths with optional from/lines; use after memory_search to pull only needed lines.",
    parameters: MemoryGetSchema,
    execute: async (_toolCallId, params) => {
      const relPath = readStringParam(params, "path", { required: true });
      const from = readNumberParam(params, "from", { integer: true });
      const lines = readNumberParam(params, "lines", { integer: true });
      const { manager, error } = await getMemorySearchManager({
        cfg,
        agentId,
      });
      if (!manager) {
        return jsonResult({ path: relPath, text: "", disabled: true, error });
      }
      try {
        const result = await manager.readFile({
          relPath,
          from: from ?? undefined,
          lines: lines ?? undefined,
        });
        return jsonResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ path: relPath, text: "", disabled: true, error: message });
      }
    },
  };
}
