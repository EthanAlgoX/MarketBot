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

import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  access: vi.fn(),
  realpath: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { access: fsMocks.access, realpath: fsMocks.realpath },
  access: fsMocks.access,
  realpath: fsMocks.realpath,
}));

import { resolveGatewayProgramArguments } from "./program-args.js";

const originalArgv = [...process.argv];

afterEach(() => {
  process.argv = [...originalArgv];
  vi.resetAllMocks();
});

describe("resolveGatewayProgramArguments", () => {
  it("uses realpath-resolved dist entry when running via npx shim", async () => {
    const argv1 = path.resolve("/tmp/.npm/_npx/63c3/node_modules/.bin/marketbot");
    const entryPath = path.resolve("/tmp/.npm/_npx/63c3/node_modules/marketbot/dist/entry.js");
    process.argv = ["node", argv1];
    fsMocks.realpath.mockResolvedValue(entryPath);
    fsMocks.access.mockImplementation(async (target: string) => {
      if (target === entryPath) {
        return;
      }
      throw new Error("missing");
    });

    const result = await resolveGatewayProgramArguments({ port: 18789 });

    expect(result.programArguments).toEqual([
      process.execPath,
      entryPath,
      "gateway",
      "--port",
      "18789",
    ]);
  });

  it("prefers symlinked path over realpath for stable service config", async () => {
    // Simulates pnpm global install where node_modules/marketbot is a symlink
    // to .pnpm/marketbot@X.Y.Z/node_modules/marketbot
    const symlinkPath = path.resolve(
      "/Users/test/Library/pnpm/global/5/node_modules/marketbot/dist/entry.js",
    );
    const realpathResolved = path.resolve(
      "/Users/test/Library/pnpm/global/5/node_modules/.pnpm/marketbot@2026.1.21-2/node_modules/marketbot/dist/entry.js",
    );
    process.argv = ["node", symlinkPath];
    fsMocks.realpath.mockResolvedValue(realpathResolved);
    fsMocks.access.mockResolvedValue(undefined); // Both paths exist

    const result = await resolveGatewayProgramArguments({ port: 18789 });

    // Should use the symlinked path, not the realpath-resolved versioned path
    expect(result.programArguments[1]).toBe(symlinkPath);
    expect(result.programArguments[1]).not.toContain("@2026.1.21-2");
  });

  it("falls back to node_modules package dist when .bin path is not resolved", async () => {
    const argv1 = path.resolve("/tmp/.npm/_npx/63c3/node_modules/.bin/marketbot");
    const indexPath = path.resolve("/tmp/.npm/_npx/63c3/node_modules/marketbot/dist/index.js");
    process.argv = ["node", argv1];
    fsMocks.realpath.mockRejectedValue(new Error("no realpath"));
    fsMocks.access.mockImplementation(async (target: string) => {
      if (target === indexPath) {
        return;
      }
      throw new Error("missing");
    });

    const result = await resolveGatewayProgramArguments({ port: 18789 });

    expect(result.programArguments).toEqual([
      process.execPath,
      indexPath,
      "gateway",
      "--port",
      "18789",
    ]);
  });
});
