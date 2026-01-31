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

import { describe, expect, it, vi } from "vitest";

const { buildProgram } = await import("./program.js");

describe("dns cli", () => {
  it("prints setup info (no apply)", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = buildProgram();
    await program.parseAsync(["dns", "setup", "--domain", "marketbot.internal"], { from: "user" });
    const output = log.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("DNS setup");
    expect(output).toContain("marketbot.internal");
  });
});
