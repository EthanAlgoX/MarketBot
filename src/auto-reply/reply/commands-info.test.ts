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
import { buildCommandsPaginationKeyboard } from "./commands-info.js";

describe("buildCommandsPaginationKeyboard", () => {
  it("adds agent id to callback data when provided", () => {
    const keyboard = buildCommandsPaginationKeyboard(2, 3, "agent-main");
    expect(keyboard[0]).toEqual([
      { text: "◀ Prev", callback_data: "commands_page_1:agent-main" },
      { text: "2/3", callback_data: "commands_page_noop:agent-main" },
      { text: "Next ▶", callback_data: "commands_page_3:agent-main" },
    ]);
  });
});
