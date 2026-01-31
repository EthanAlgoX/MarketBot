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

import * as ops from "./service/ops.js";
import { type CronServiceDeps, createCronServiceState } from "./service/state.js";
import type { CronJobCreate, CronJobPatch } from "./types.js";

export type { CronEvent, CronServiceDeps } from "./service/state.js";

export class CronService {
  private readonly state;
  constructor(deps: CronServiceDeps) {
    this.state = createCronServiceState(deps);
  }

  async start() {
    await ops.start(this.state);
  }

  stop() {
    ops.stop(this.state);
  }

  async status() {
    return await ops.status(this.state);
  }

  async list(opts?: { includeDisabled?: boolean }) {
    return await ops.list(this.state, opts);
  }

  async add(input: CronJobCreate) {
    return await ops.add(this.state, input);
  }

  async update(id: string, patch: CronJobPatch) {
    return await ops.update(this.state, id, patch);
  }

  async remove(id: string) {
    return await ops.remove(this.state, id);
  }

  async run(id: string, mode?: "due" | "force") {
    return await ops.run(this.state, id, mode);
  }

  wake(opts: { mode: "now" | "next-heartbeat"; text: string }) {
    return ops.wakeNow(this.state, opts);
  }
}
