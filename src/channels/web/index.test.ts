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

import * as impl from "../../channel-web.js";
import * as entry from "./index.js";

describe("channels/web entrypoint", () => {
  it("re-exports web channel helpers", () => {
    expect(entry.createWaSocket).toBe(impl.createWaSocket);
    expect(entry.loginWeb).toBe(impl.loginWeb);
    expect(entry.logWebSelfId).toBe(impl.logWebSelfId);
    expect(entry.monitorWebInbox).toBe(impl.monitorWebInbox);
    expect(entry.monitorWebChannel).toBe(impl.monitorWebChannel);
    expect(entry.pickWebChannel).toBe(impl.pickWebChannel);
    expect(entry.sendMessageWhatsApp).toBe(impl.sendMessageWhatsApp);
    expect(entry.WA_WEB_AUTH_DIR).toBe(impl.WA_WEB_AUTH_DIR);
    expect(entry.waitForWaConnection).toBe(impl.waitForWaConnection);
    expect(entry.webAuthExists).toBe(impl.webAuthExists);
  });
});
