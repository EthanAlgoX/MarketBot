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

import { isMainModule } from "./is-main.js";

describe("isMainModule", () => {
  it("returns true when argv[1] matches current file", () => {
    expect(
      isMainModule({
        currentFile: "/repo/dist/index.js",
        argv: ["node", "/repo/dist/index.js"],
        cwd: "/repo",
        env: {},
      }),
    ).toBe(true);
  });

  it("returns true under PM2 when pm_exec_path matches current file", () => {
    expect(
      isMainModule({
        currentFile: "/repo/dist/index.js",
        argv: ["node", "/pm2/lib/ProcessContainerFork.js"],
        cwd: "/repo",
        env: { pm_exec_path: "/repo/dist/index.js", pm_id: "0" },
      }),
    ).toBe(true);
  });

  it("returns false when running under PM2 but this module is imported", () => {
    expect(
      isMainModule({
        currentFile: "/repo/node_modules/marketbot/dist/index.js",
        argv: ["node", "/repo/app.js"],
        cwd: "/repo",
        env: { pm_exec_path: "/repo/app.js", pm_id: "0" },
      }),
    ).toBe(false);
  });
});
