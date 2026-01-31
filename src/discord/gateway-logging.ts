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

import type { EventEmitter } from "node:events";

import { logVerbose } from "../globals.js";
import type { RuntimeEnv } from "../runtime.js";

type GatewayEmitter = Pick<EventEmitter, "on" | "removeListener">;

const INFO_DEBUG_MARKERS = [
  "WebSocket connection closed",
  "Reconnecting with backoff",
  "Attempting resume with backoff",
];

const shouldPromoteGatewayDebug = (message: string) =>
  INFO_DEBUG_MARKERS.some((marker) => message.includes(marker));

const formatGatewayMetrics = (metrics: unknown) => {
  if (metrics === null || metrics === undefined) {
    return String(metrics);
  }
  if (typeof metrics === "string") {
    return metrics;
  }
  if (typeof metrics === "number" || typeof metrics === "boolean" || typeof metrics === "bigint") {
    return String(metrics);
  }
  try {
    return JSON.stringify(metrics);
  } catch {
    return "[unserializable metrics]";
  }
};

export function attachDiscordGatewayLogging(params: {
  emitter?: GatewayEmitter;
  runtime: RuntimeEnv;
}) {
  const { emitter, runtime } = params;
  if (!emitter) {
    return () => {};
  }

  const onGatewayDebug = (msg: unknown) => {
    const message = String(msg);
    logVerbose(`discord gateway: ${message}`);
    if (shouldPromoteGatewayDebug(message)) {
      runtime.log?.(`discord gateway: ${message}`);
    }
  };

  const onGatewayWarning = (warning: unknown) => {
    logVerbose(`discord gateway warning: ${String(warning)}`);
  };

  const onGatewayMetrics = (metrics: unknown) => {
    logVerbose(`discord gateway metrics: ${formatGatewayMetrics(metrics)}`);
  };

  emitter.on("debug", onGatewayDebug);
  emitter.on("warning", onGatewayWarning);
  emitter.on("metrics", onGatewayMetrics);

  return () => {
    emitter.removeListener("debug", onGatewayDebug);
    emitter.removeListener("warning", onGatewayWarning);
    emitter.removeListener("metrics", onGatewayMetrics);
  };
}
