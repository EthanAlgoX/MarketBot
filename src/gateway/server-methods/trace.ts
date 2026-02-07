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

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { getTraceRunEvents, listTraceRuns } from "../trace-store.js";

export const traceHandlers: GatewayRequestHandlers = {
  "trace.runs.list": async ({ params, respond }) => {
    const limitRaw = (params as { limit?: unknown } | undefined)?.limit;
    const limit = typeof limitRaw === "number" ? limitRaw : undefined;
    try {
      const runs = await listTraceRuns({ limit });
      respond(true, { runs }, undefined, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)), undefined);
    }
  },

  "trace.run.get": async ({ params, respond }) => {
    const p = params as { runId?: unknown; limit?: unknown };
    const runId = typeof p.runId === "string" ? p.runId.trim() : "";
    if (!runId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "runId is required"));
      return;
    }
    const limit = typeof p.limit === "number" ? p.limit : undefined;
    try {
      const res = await getTraceRunEvents({ runId, limit });
      respond(true, res, undefined, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)), undefined);
    }
  },
};
