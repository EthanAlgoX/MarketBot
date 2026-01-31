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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __testing,
  consumeGatewaySigusr1RestartAuthorization,
  isGatewaySigusr1RestartExternallyAllowed,
  scheduleGatewaySigusr1Restart,
  setGatewaySigusr1RestartPolicy,
} from "./restart.js";

describe("restart authorization", () => {
  beforeEach(() => {
    __testing.resetSigusr1State();
    vi.useFakeTimers();
    vi.spyOn(process, "kill").mockImplementation(() => true);
  });

  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    vi.restoreAllMocks();
    __testing.resetSigusr1State();
  });

  it("consumes a scheduled authorization once", async () => {
    expect(consumeGatewaySigusr1RestartAuthorization()).toBe(false);

    scheduleGatewaySigusr1Restart({ delayMs: 0 });

    expect(consumeGatewaySigusr1RestartAuthorization()).toBe(true);
    expect(consumeGatewaySigusr1RestartAuthorization()).toBe(false);

    await vi.runAllTimersAsync();
  });

  it("tracks external restart policy", () => {
    expect(isGatewaySigusr1RestartExternallyAllowed()).toBe(false);
    setGatewaySigusr1RestartPolicy({ allowExternal: true });
    expect(isGatewaySigusr1RestartExternallyAllowed()).toBe(true);
  });
});
