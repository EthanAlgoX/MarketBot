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

import { loadVoiceWakeConfig, setVoiceWakeTriggers } from "../../infra/voicewake.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { normalizeVoiceWakeTriggers } from "../server-utils.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

export const voicewakeHandlers: GatewayRequestHandlers = {
  "voicewake.get": async ({ respond }) => {
    try {
      const cfg = await loadVoiceWakeConfig();
      respond(true, { triggers: cfg.triggers });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "voicewake.set": async ({ params, respond, context }) => {
    if (!Array.isArray(params.triggers)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "voicewake.set requires triggers: string[]"),
      );
      return;
    }
    try {
      const triggers = normalizeVoiceWakeTriggers(params.triggers);
      const cfg = await setVoiceWakeTriggers(triggers);
      context.broadcastVoiceWakeChanged(cfg.triggers);
      respond(true, { triggers: cfg.triggers });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
};
