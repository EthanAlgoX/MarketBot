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
import { sanitizeToolCallId } from "./pi-embedded-helpers.js";

describe("sanitizeToolCallId", () => {
  describe("strict mode (default)", () => {
    it("keeps valid alphanumeric tool call IDs", () => {
      expect(sanitizeToolCallId("callabc123")).toBe("callabc123");
    });
    it("strips underscores and hyphens", () => {
      expect(sanitizeToolCallId("call_abc-123")).toBe("callabc123");
      expect(sanitizeToolCallId("call_abc_def")).toBe("callabcdef");
    });
    it("strips invalid characters", () => {
      expect(sanitizeToolCallId("call_abc|item:456")).toBe("callabcitem456");
    });
    it("returns default for empty IDs", () => {
      expect(sanitizeToolCallId("")).toBe("defaulttoolid");
    });
  });

  describe("strict mode (alphanumeric only)", () => {
    it("strips all non-alphanumeric characters", () => {
      expect(sanitizeToolCallId("call_abc-123", "strict")).toBe("callabc123");
      expect(sanitizeToolCallId("call_abc|item:456", "strict")).toBe("callabcitem456");
      expect(sanitizeToolCallId("whatsapp_login_1768799841527_1", "strict")).toBe(
        "whatsapplogin17687998415271",
      );
    });
    it("returns default for empty IDs", () => {
      expect(sanitizeToolCallId("", "strict")).toBe("defaulttoolid");
    });
  });

  describe("strict9 mode (Mistral tool call IDs)", () => {
    it("returns alphanumeric IDs with length 9", () => {
      const out = sanitizeToolCallId("call_abc|item:456", "strict9");
      expect(out).toMatch(/^[a-zA-Z0-9]{9}$/);
    });
    it("returns default for empty IDs", () => {
      expect(sanitizeToolCallId("", "strict9")).toMatch(/^[a-zA-Z0-9]{9}$/);
    });
  });
});
