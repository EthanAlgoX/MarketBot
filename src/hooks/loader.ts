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

/**
 * Dynamic loader for hook handlers
 *
 * Loads hook handlers from external modules based on configuration
 * and from directory-based discovery (bundled, managed, workspace)
 */

import { pathToFileURL } from "node:url";
import path from "node:path";
import { registerInternalHook } from "./internal-hooks.js";
import type { MarketBotConfig } from "../config/config.js";
import type { InternalHookHandler } from "./internal-hooks.js";
import { loadWorkspaceHookEntries } from "./workspace.js";
import { resolveHookConfig } from "./config.js";
import { shouldIncludeHook } from "./config.js";

/**
 * Load and register all hook handlers
 *
 * Loads hooks from both:
 * 1. Directory-based discovery (bundled, managed, workspace)
 * 2. Legacy config handlers (backwards compatibility)
 *
 * @param cfg - MarketBot configuration
 * @param workspaceDir - Workspace directory for hook discovery
 * @returns Number of handlers successfully loaded
 *
 * @example
 * ```ts
 * const config = await loadConfig();
 * const workspaceDir = resolveAgentWorkspaceDir(config, agentId);
 * const count = await loadInternalHooks(config, workspaceDir);
 * console.log(`Loaded ${count} hook handlers`);
 * ```
 */
export async function loadInternalHooks(
  cfg: MarketBotConfig,
  workspaceDir: string,
): Promise<number> {
  // Check if hooks are enabled
  if (!cfg.hooks?.internal?.enabled) {
    return 0;
  }

  let loadedCount = 0;

  // 1. Load hooks from directories (new system)
  try {
    const hookEntries = loadWorkspaceHookEntries(workspaceDir, { config: cfg });

    // Filter by eligibility
    const eligible = hookEntries.filter((entry) => shouldIncludeHook({ entry, config: cfg }));

    for (const entry of eligible) {
      const hookConfig = resolveHookConfig(cfg, entry.hook.name);

      // Skip if explicitly disabled in config
      if (hookConfig?.enabled === false) {
        continue;
      }

      try {
        // Import handler module with cache-busting
        const url = pathToFileURL(entry.hook.handlerPath).href;
        const cacheBustedUrl = `${url}?t=${Date.now()}`;
        const mod = (await import(cacheBustedUrl)) as Record<string, unknown>;

        // Get handler function (default or named export)
        const exportName = entry.metadata?.export ?? "default";
        const handler = mod[exportName];

        if (typeof handler !== "function") {
          console.error(
            `Hook error: Handler '${exportName}' from ${entry.hook.name} is not a function`,
          );
          continue;
        }

        // Register for all events listed in metadata
        const events = entry.metadata?.events ?? [];
        if (events.length === 0) {
          console.warn(`Hook warning: Hook '${entry.hook.name}' has no events defined in metadata`);
          continue;
        }

        for (const event of events) {
          registerInternalHook(event, handler as InternalHookHandler);
        }

        console.log(
          `Registered hook: ${entry.hook.name} -> ${events.join(", ")}${exportName !== "default" ? ` (export: ${exportName})` : ""}`,
        );
        loadedCount++;
      } catch (err) {
        console.error(
          `Failed to load hook ${entry.hook.name}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  } catch (err) {
    console.error(
      "Failed to load directory-based hooks:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 2. Load legacy config handlers (backwards compatibility)
  const handlers = cfg.hooks.internal.handlers ?? [];
  for (const handlerConfig of handlers) {
    try {
      // Resolve module path (absolute or relative to cwd)
      const modulePath = path.isAbsolute(handlerConfig.module)
        ? handlerConfig.module
        : path.join(process.cwd(), handlerConfig.module);

      // Import the module with cache-busting to ensure fresh reload
      const url = pathToFileURL(modulePath).href;
      const cacheBustedUrl = `${url}?t=${Date.now()}`;
      const mod = (await import(cacheBustedUrl)) as Record<string, unknown>;

      // Get the handler function
      const exportName = handlerConfig.export ?? "default";
      const handler = mod[exportName];

      if (typeof handler !== "function") {
        console.error(`Hook error: Handler '${exportName}' from ${modulePath} is not a function`);
        continue;
      }

      // Register the handler
      registerInternalHook(handlerConfig.event, handler as InternalHookHandler);
      console.log(
        `Registered hook (legacy): ${handlerConfig.event} -> ${modulePath}${exportName !== "default" ? `#${exportName}` : ""}`,
      );
      loadedCount++;
    } catch (err) {
      console.error(
        `Failed to load hook handler from ${handlerConfig.module}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return loadedCount;
}
