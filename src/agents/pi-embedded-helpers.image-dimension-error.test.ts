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

import { isImageDimensionErrorMessage, parseImageDimensionError } from "./pi-embedded-helpers.js";

describe("image dimension errors", () => {
  it("parses anthropic image dimension errors", () => {
    const raw =
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.84.content.1.image.source.base64.data: At least one of the image dimensions exceed max allowed size for many-image requests: 2000 pixels"}}';
    const parsed = parseImageDimensionError(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.maxDimensionPx).toBe(2000);
    expect(parsed?.messageIndex).toBe(84);
    expect(parsed?.contentIndex).toBe(1);
    expect(isImageDimensionErrorMessage(raw)).toBe(true);
  });
});
