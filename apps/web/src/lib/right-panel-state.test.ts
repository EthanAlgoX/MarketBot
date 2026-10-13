// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readRightPanelState,
  rightPanelStorageKey,
  writeRightPanelState,
} from "./right-panel-state";

afterEach(() => vi.unstubAllGlobals());
describe("right panel preferences", () => {
  it("round trips closed state and only the selected routine reference", () => {
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
    });
    writeRightPanelState("user-a:space-a:bot-a", "routine", "routine-a");
    expect(readRightPanelState("user-a:space-a:bot-a")).toEqual({
      panel: "routine",
      routineId: "routine-a",
    });
    expect(readRightPanelState("user-b:space-a:bot-a")).toEqual({ panel: null });
    writeRightPanelState("user-a:space-a:bot-a", null, "routine-a");
    expect(readRightPanelState("user-a:space-a:bot-a")).toEqual({ panel: null });
  });
  it.each(["not json", "null", "[]", '{"panel":"unknown"}', '{"panel":{}}', '{"panel":"create"}'])(
    "ignores malformed preference %s",
    (value) => {
      vi.stubGlobal("localStorage", { getItem: () => value });
      expect(readRightPanelState("state")).toEqual({ panel: null });
    },
  );
  it("keeps working when browser storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(readRightPanelState("state")).toEqual({ panel: null });
    expect(() => writeRightPanelState("state", "computer")).not.toThrow();
  });
  it("skips ephemeral create panels and builds scoped keys", () => {
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
    });
    const key = rightPanelStorageKey("user-a", "space-a", "bot", "bot-a");
    expect(key).toBe("marketbot:right-panel-state:user-a:space-a:bot:bot-a");
    writeRightPanelState(key, "computer");
    writeRightPanelState(key, "create");
    expect(readRightPanelState(key)).toEqual({ panel: "computer" });
    writeRightPanelState(key, "create-group");
    expect(readRightPanelState(key)).toEqual({ panel: "computer" });
  });
});
