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
import { isCloudCodeAssistFormatError } from "./pi-embedded-helpers.js";
import { DEFAULT_AGENTS_FILENAME } from "./workspace.js";

const _makeFile = (overrides: Partial<WorkspaceBootstrapFile>): WorkspaceBootstrapFile => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: "/tmp/AGENTS.md",
  content: "",
  missing: false,
  ...overrides,
});
describe("isCloudCodeAssistFormatError", () => {
  it("matches format errors", () => {
    const samples = [
      "INVALID_REQUEST_ERROR: string should match pattern",
      "messages.1.content.1.tool_use.id",
      "tool_use.id should match pattern",
      "invalid request format",
    ];
    for (const sample of samples) {
      expect(isCloudCodeAssistFormatError(sample)).toBe(true);
    }
  });
  it("ignores unrelated errors", () => {
    expect(isCloudCodeAssistFormatError("rate limit exceeded")).toBe(false);
    expect(
      isCloudCodeAssistFormatError(
        '400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.84.content.1.image.source.base64.data: At least one of the image dimensions exceed max allowed size for many-image requests: 2000 pixels"}}',
      ),
    ).toBe(false);
  });
});
