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

import {
  buildRoleSnapshotFromAiSnapshot,
  buildRoleSnapshotFromAriaSnapshot,
  getRoleSnapshotStats,
  parseRoleRef,
} from "./pw-role-snapshot.js";

describe("pw-role-snapshot", () => {
  it("adds refs for interactive elements", () => {
    const aria = [
      '- heading "Example" [level=1]',
      "- paragraph: hello",
      '- button "Submit"',
      "  - generic",
      '- link "Learn more"',
    ].join("\n");

    const res = buildRoleSnapshotFromAriaSnapshot(aria, { interactive: true });
    expect(res.snapshot).toContain("[ref=e1]");
    expect(res.snapshot).toContain("[ref=e2]");
    expect(res.snapshot).toContain('- button "Submit" [ref=e1]');
    expect(res.snapshot).toContain('- link "Learn more" [ref=e2]');
    expect(Object.keys(res.refs)).toEqual(["e1", "e2"]);
    expect(res.refs.e1).toMatchObject({ role: "button", name: "Submit" });
    expect(res.refs.e2).toMatchObject({ role: "link", name: "Learn more" });
  });

  it("uses nth only when duplicates exist", () => {
    const aria = ['- button "OK"', '- button "OK"', '- button "Cancel"'].join("\n");
    const res = buildRoleSnapshotFromAriaSnapshot(aria);
    expect(res.snapshot).toContain("[ref=e1]");
    expect(res.snapshot).toContain("[ref=e2] [nth=1]");
    expect(res.refs.e1?.nth).toBe(0);
    expect(res.refs.e2?.nth).toBe(1);
    expect(res.refs.e3?.nth).toBeUndefined();
  });
  it("respects maxDepth", () => {
    const aria = ['- region "Main"', "  - group", '    - button "Deep"'].join("\n");
    const res = buildRoleSnapshotFromAriaSnapshot(aria, { maxDepth: 1 });
    expect(res.snapshot).toContain('- region "Main"');
    expect(res.snapshot).toContain("  - group");
    expect(res.snapshot).not.toContain("button");
  });

  it("computes stats", () => {
    const aria = ['- button "OK"', '- button "Cancel"'].join("\n");
    const res = buildRoleSnapshotFromAriaSnapshot(aria);
    const stats = getRoleSnapshotStats(res.snapshot, res.refs);
    expect(stats.refs).toBe(2);
    expect(stats.interactive).toBe(2);
    expect(stats.lines).toBeGreaterThan(0);
    expect(stats.chars).toBeGreaterThan(0);
  });

  it("returns a helpful message when no interactive elements exist", () => {
    const aria = ['- heading "Hello"', "- paragraph: world"].join("\n");
    const res = buildRoleSnapshotFromAriaSnapshot(aria, { interactive: true });
    expect(res.snapshot).toBe("(no interactive elements)");
    expect(Object.keys(res.refs)).toEqual([]);
  });

  it("parses role refs", () => {
    expect(parseRoleRef("e12")).toBe("e12");
    expect(parseRoleRef("@e12")).toBe("e12");
    expect(parseRoleRef("ref=e12")).toBe("e12");
    expect(parseRoleRef("12")).toBeNull();
    expect(parseRoleRef("")).toBeNull();
  });

  it("preserves Playwright aria-ref ids in ai snapshots", () => {
    const ai = [
      "- navigation [ref=e1]:",
      '  - link "Home" [ref=e5]',
      '  - heading "Title" [ref=e6]',
      '  - button "Save" [ref=e7] [cursor=pointer]:',
      "  - paragraph: hello",
    ].join("\n");

    const res = buildRoleSnapshotFromAiSnapshot(ai, { interactive: true });
    expect(res.snapshot).toContain("[ref=e5]");
    expect(res.snapshot).toContain('- link "Home"');
    expect(res.snapshot).toContain('- button "Save"');
    expect(res.snapshot).not.toContain("navigation");
    expect(res.snapshot).not.toContain("heading");
    expect(Object.keys(res.refs).toSorted()).toEqual(["e5", "e7"]);
    expect(res.refs.e5).toMatchObject({ role: "link", name: "Home" });
    expect(res.refs.e7).toMatchObject({ role: "button", name: "Save" });
  });
});
