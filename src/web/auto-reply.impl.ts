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

export { HEARTBEAT_PROMPT, stripHeartbeatToken } from "../auto-reply/heartbeat.js";
export { HEARTBEAT_TOKEN, SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";

export { DEFAULT_WEB_MEDIA_BYTES } from "./auto-reply/constants.js";
export { resolveHeartbeatRecipients, runWebHeartbeatOnce } from "./auto-reply/heartbeat-runner.js";
export { monitorWebChannel } from "./auto-reply/monitor.js";
export type { WebChannelStatus, WebMonitorTuning } from "./auto-reply/types.js";
