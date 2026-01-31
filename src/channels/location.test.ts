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

import { formatLocationText, toLocationContext } from "./location.js";

describe("provider location helpers", () => {
  it("formats pin locations with accuracy", () => {
    const text = formatLocationText({
      latitude: 48.858844,
      longitude: 2.294351,
      accuracy: 12,
    });
    expect(text).toBe("📍 48.858844, 2.294351 ±12m");
  });

  it("formats named places with address and caption", () => {
    const text = formatLocationText({
      latitude: 40.689247,
      longitude: -74.044502,
      name: "Statue of Liberty",
      address: "Liberty Island, NY",
      accuracy: 8,
      caption: "Bring snacks",
    });
    expect(text).toBe(
      "📍 Statue of Liberty — Liberty Island, NY (40.689247, -74.044502 ±8m)\nBring snacks",
    );
  });

  it("formats live locations with live label", () => {
    const text = formatLocationText({
      latitude: 37.819929,
      longitude: -122.478255,
      accuracy: 20,
      caption: "On the move",
      isLive: true,
      source: "live",
    });
    expect(text).toBe("🛰 Live location: 37.819929, -122.478255 ±20m\nOn the move");
  });

  it("builds ctx fields with normalized source", () => {
    const ctx = toLocationContext({
      latitude: 1,
      longitude: 2,
      name: "Cafe",
      address: "Main St",
    });
    expect(ctx).toEqual({
      LocationLat: 1,
      LocationLon: 2,
      LocationAccuracy: undefined,
      LocationName: "Cafe",
      LocationAddress: "Main St",
      LocationSource: "place",
      LocationIsLive: false,
    });
  });
});
