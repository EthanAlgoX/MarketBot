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
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it("detects help/version flags", () => {
    expect(hasHelpOrVersion(["node", "marketbot", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "marketbot", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "marketbot", "status"])).toBe(false);
  });

  it("extracts command path ignoring flags and terminator", () => {
    expect(getCommandPath(["node", "marketbot", "status", "--json"], 2)).toEqual(["status"]);
    expect(getCommandPath(["node", "marketbot", "agents", "list"], 2)).toEqual(["agents", "list"]);
    expect(getCommandPath(["node", "marketbot", "status", "--", "ignored"], 2)).toEqual(["status"]);
  });

  it("returns primary command", () => {
    expect(getPrimaryCommand(["node", "marketbot", "agents", "list"])).toBe("agents");
    expect(getPrimaryCommand(["node", "marketbot"])).toBeNull();
  });

  it("parses boolean flags and ignores terminator", () => {
    expect(hasFlag(["node", "marketbot", "status", "--json"], "--json")).toBe(true);
    expect(hasFlag(["node", "marketbot", "--", "--json"], "--json")).toBe(false);
  });

  it("extracts flag values with equals and missing values", () => {
    expect(getFlagValue(["node", "marketbot", "status", "--timeout", "5000"], "--timeout")).toBe(
      "5000",
    );
    expect(getFlagValue(["node", "marketbot", "status", "--timeout=2500"], "--timeout")).toBe(
      "2500",
    );
    expect(getFlagValue(["node", "marketbot", "status", "--timeout"], "--timeout")).toBeNull();
    expect(getFlagValue(["node", "marketbot", "status", "--timeout", "--json"], "--timeout")).toBe(
      null,
    );
    expect(getFlagValue(["node", "marketbot", "--", "--timeout=99"], "--timeout")).toBeUndefined();
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "marketbot", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "marketbot", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "marketbot", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it("parses positive integer flag values", () => {
    expect(getPositiveIntFlagValue(["node", "marketbot", "status"], "--timeout")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "marketbot", "status", "--timeout"], "--timeout"),
    ).toBeNull();
    expect(
      getPositiveIntFlagValue(["node", "marketbot", "status", "--timeout", "5000"], "--timeout"),
    ).toBe(5000);
    expect(
      getPositiveIntFlagValue(["node", "marketbot", "status", "--timeout", "nope"], "--timeout"),
    ).toBeUndefined();
  });

  it("builds parse argv from raw args", () => {
    const nodeArgv = buildParseArgv({
      programName: "marketbot",
      rawArgs: ["node", "marketbot", "status"],
    });
    expect(nodeArgv).toEqual(["node", "marketbot", "status"]);

    const versionedNodeArgv = buildParseArgv({
      programName: "marketbot",
      rawArgs: ["node-22", "marketbot", "status"],
    });
    expect(versionedNodeArgv).toEqual(["node-22", "marketbot", "status"]);

    const versionedNodeWindowsArgv = buildParseArgv({
      programName: "marketbot",
      rawArgs: ["node-22.2.0.exe", "marketbot", "status"],
    });
    expect(versionedNodeWindowsArgv).toEqual(["node-22.2.0.exe", "marketbot", "status"]);

    const versionedNodePatchlessArgv = buildParseArgv({
      programName: "marketbot",
      rawArgs: ["node-22.2", "marketbot", "status"],
    });
    expect(versionedNodePatchlessArgv).toEqual(["node-22.2", "marketbot", "status"]);

    const versionedNodeWindowsPatchlessArgv = buildParseArgv({
      programName: "marketbot",
      rawArgs: ["node-22.2.exe", "marketbot", "status"],
    });
    expect(versionedNodeWindowsPatchlessArgv).toEqual(["node-22.2.exe", "marketbot", "status"]);

    const versionedNodeWithPathArgv = buildParseArgv({
      programName: "marketbot",
      rawArgs: ["/usr/bin/node-22.2.0", "marketbot", "status"],
    });
    expect(versionedNodeWithPathArgv).toEqual(["/usr/bin/node-22.2.0", "marketbot", "status"]);

    const nodejsArgv = buildParseArgv({
      programName: "marketbot",
      rawArgs: ["nodejs", "marketbot", "status"],
    });
    expect(nodejsArgv).toEqual(["nodejs", "marketbot", "status"]);

    const nonVersionedNodeArgv = buildParseArgv({
      programName: "marketbot",
      rawArgs: ["node-dev", "marketbot", "status"],
    });
    expect(nonVersionedNodeArgv).toEqual(["node", "marketbot", "node-dev", "marketbot", "status"]);

    const directArgv = buildParseArgv({
      programName: "marketbot",
      rawArgs: ["marketbot", "status"],
    });
    expect(directArgv).toEqual(["node", "marketbot", "status"]);

    const bunArgv = buildParseArgv({
      programName: "marketbot",
      rawArgs: ["bun", "src/entry.ts", "status"],
    });
    expect(bunArgv).toEqual(["bun", "src/entry.ts", "status"]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "marketbot",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "marketbot", "status"]);
  });

  it("decides when to migrate state", () => {
    expect(shouldMigrateState(["node", "marketbot", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "marketbot", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "marketbot", "sessions"])).toBe(false);
    expect(shouldMigrateState(["node", "marketbot", "memory", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "marketbot", "agent", "--message", "hi"])).toBe(false);
    expect(shouldMigrateState(["node", "marketbot", "agents", "list"])).toBe(true);
    expect(shouldMigrateState(["node", "marketbot", "message", "send"])).toBe(true);
  });

  it("reuses command path for migrate state decisions", () => {
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agents", "list"])).toBe(true);
  });
});
