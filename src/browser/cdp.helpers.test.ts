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

import { appendCdpPath, getHeadersWithAuth } from "./cdp.helpers.js";

describe("cdp.helpers", () => {
  it("preserves query params when appending CDP paths", () => {
    const url = appendCdpPath("https://example.com?token=abc", "/json/version");
    expect(url).toBe("https://example.com/json/version?token=abc");
  });

  it("appends paths under a base prefix", () => {
    const url = appendCdpPath("https://example.com/chrome/?token=abc", "json/list");
    expect(url).toBe("https://example.com/chrome/json/list?token=abc");
  });

  it("adds basic auth headers when credentials are present", () => {
    const headers = getHeadersWithAuth("https://user:pass@example.com");
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("user:pass").toString("base64")}`);
  });

  it("keeps preexisting authorization headers", () => {
    const headers = getHeadersWithAuth("https://user:pass@example.com", {
      Authorization: "Bearer token",
    });
    expect(headers.Authorization).toBe("Bearer token");
  });
});
