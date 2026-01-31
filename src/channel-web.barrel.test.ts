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

import * as mod from "./channel-web.js";

describe("channel-web barrel", () => {
  it("exports the expected web helpers", () => {
    expect(mod.createWaSocket).toBeTypeOf("function");
    expect(mod.loginWeb).toBeTypeOf("function");
    expect(mod.monitorWebChannel).toBeTypeOf("function");
    expect(mod.sendMessageWhatsApp).toBeTypeOf("function");
    expect(mod.monitorWebInbox).toBeTypeOf("function");
    expect(mod.pickWebChannel).toBeTypeOf("function");
    expect(mod.WA_WEB_AUTH_DIR).toBeTruthy();
  });
});
