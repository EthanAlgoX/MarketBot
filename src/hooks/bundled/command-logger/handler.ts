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
 * Example hook handler: Log all commands to a file
 *
 * This handler demonstrates how to create a hook that logs all command events
 * to a centralized log file for audit/debugging purposes.
 *
 * To enable this handler, add it to your config:
 *
 * ```json
 * {
 *   "hooks": {
 *     "internal": {
 *       "enabled": true,
 *       "handlers": [
 *         {
 *           "event": "command",
 *           "module": "./hooks/handlers/command-logger.ts"
 *         }
 *       ]
 *     }
 *   }
 * }
 * ```
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { HookHandler } from "../../hooks.js";

/**
 * Log all command events to a file
 */
const logCommand: HookHandler = async (event) => {
  // Only trigger on command events
  if (event.type !== "command") {
    return;
  }

  try {
    // Create log directory
    const stateDir =
      process.env.MARKETBOT_STATE_DIR?.trim() || path.join(os.homedir(), ".marketbot");
    const logDir = path.join(stateDir, "logs");
    await fs.mkdir(logDir, { recursive: true });

    // Append to command log file
    const logFile = path.join(logDir, "commands.log");
    const logLine =
      JSON.stringify({
        timestamp: event.timestamp.toISOString(),
        action: event.action,
        sessionKey: event.sessionKey,
        senderId: event.context.senderId ?? "unknown",
        source: event.context.commandSource ?? "unknown",
      }) + "\n";

    await fs.appendFile(logFile, logLine, "utf-8");
  } catch (err) {
    console.error(
      "[command-logger] Failed to log command:",
      err instanceof Error ? err.message : String(err),
    );
  }
};

export default logCommand;
