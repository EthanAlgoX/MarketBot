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

import { resolveTargetIdFromTabs } from "./target-id.js";

describe("browser target id resolution", () => {
  it("resolves exact ids", () => {
    const res = resolveTargetIdFromTabs("FULL", [{ targetId: "AAA" }, { targetId: "FULL" }]);
    expect(res).toEqual({ ok: true, targetId: "FULL" });
  });

  it("resolves unique prefixes (case-insensitive)", () => {
    const res = resolveTargetIdFromTabs("57a01309", [
      { targetId: "57A01309E14B5DEE0FB41F908515A2FC" },
    ]);
    expect(res).toEqual({
      ok: true,
      targetId: "57A01309E14B5DEE0FB41F908515A2FC",
    });
  });

  it("fails on ambiguous prefixes", () => {
    const res = resolveTargetIdFromTabs("57A0", [
      { targetId: "57A01309E14B5DEE0FB41F908515A2FC" },
      { targetId: "57A0BEEF000000000000000000000000" },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("ambiguous");
      expect(res.matches?.length).toBe(2);
    }
  });

  it("fails when no tab matches", () => {
    const res = resolveTargetIdFromTabs("NOPE", [{ targetId: "AAA" }]);
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });
});
