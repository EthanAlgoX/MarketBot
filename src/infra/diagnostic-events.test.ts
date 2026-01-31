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

import { describe, expect, test } from "vitest";

import {
  emitDiagnosticEvent,
  onDiagnosticEvent,
  resetDiagnosticEventsForTest,
} from "./diagnostic-events.js";

describe("diagnostic-events", () => {
  test("emits monotonic seq", async () => {
    resetDiagnosticEventsForTest();
    const seqs: number[] = [];
    const stop = onDiagnosticEvent((evt) => seqs.push(evt.seq));

    emitDiagnosticEvent({
      type: "model.usage",
      usage: { total: 1 },
    });
    emitDiagnosticEvent({
      type: "model.usage",
      usage: { total: 2 },
    });

    stop();

    expect(seqs).toEqual([1, 2]);
  });

  test("emits message-flow events", async () => {
    resetDiagnosticEventsForTest();
    const types: string[] = [];
    const stop = onDiagnosticEvent((evt) => types.push(evt.type));

    emitDiagnosticEvent({
      type: "webhook.received",
      channel: "telegram",
      updateType: "telegram-post",
    });
    emitDiagnosticEvent({
      type: "message.queued",
      channel: "telegram",
      source: "telegram",
      queueDepth: 1,
    });
    emitDiagnosticEvent({
      type: "session.state",
      state: "processing",
      reason: "run_started",
    });

    stop();

    expect(types).toEqual(["webhook.received", "message.queued", "session.state"]);
  });
});
