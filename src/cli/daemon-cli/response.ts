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

import { Writable } from "node:stream";

import type { GatewayService } from "../../daemon/service.js";
import { defaultRuntime } from "../../runtime.js";

export type DaemonAction = "install" | "uninstall" | "start" | "stop" | "restart";

export type DaemonActionResponse = {
  ok: boolean;
  action: DaemonAction;
  result?: string;
  message?: string;
  error?: string;
  hints?: string[];
  warnings?: string[];
  service?: {
    label: string;
    loaded: boolean;
    loadedText: string;
    notLoadedText: string;
  };
};

export function emitDaemonActionJson(payload: DaemonActionResponse) {
  defaultRuntime.log(JSON.stringify(payload, null, 2));
}

export function buildDaemonServiceSnapshot(service: GatewayService, loaded: boolean) {
  return {
    label: service.label,
    loaded,
    loadedText: service.loadedText,
    notLoadedText: service.notLoadedText,
  };
}

export function createNullWriter(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}
