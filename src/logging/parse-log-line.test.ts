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

import { describe, expect, it } from "vitest";

import { parseLogLine } from "./parse-log-line.js";

describe("parseLogLine", () => {
  it("parses structured JSON log lines", () => {
    const line = JSON.stringify({
      time: "2026-01-09T01:38:41.523Z",
      0: '{"subsystem":"gateway/channels/whatsapp"}',
      1: "connected",
      _meta: {
        name: '{"subsystem":"gateway/channels/whatsapp"}',
        logLevelName: "INFO",
      },
    });

    const parsed = parseLogLine(line);

    expect(parsed).not.toBeNull();
    expect(parsed?.time).toBe("2026-01-09T01:38:41.523Z");
    expect(parsed?.level).toBe("info");
    expect(parsed?.subsystem).toBe("gateway/channels/whatsapp");
    expect(parsed?.message).toBe('{"subsystem":"gateway/channels/whatsapp"} connected');
    expect(parsed?.raw).toBe(line);
  });

  it("falls back to meta timestamp when top-level time is missing", () => {
    const line = JSON.stringify({
      0: "hello",
      _meta: {
        name: '{"subsystem":"gateway"}',
        logLevelName: "WARN",
        date: "2026-01-09T02:10:00.000Z",
      },
    });

    const parsed = parseLogLine(line);

    expect(parsed?.time).toBe("2026-01-09T02:10:00.000Z");
    expect(parsed?.level).toBe("warn");
  });

  it("returns null for invalid JSON", () => {
    expect(parseLogLine("not-json")).toBeNull();
  });
});
