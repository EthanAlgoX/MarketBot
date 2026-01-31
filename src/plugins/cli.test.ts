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

import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  memoryRegister: vi.fn(),
  otherRegister: vi.fn(),
}));

vi.mock("./loader.js", () => ({
  loadMarketBotPlugins: () => ({
    cliRegistrars: [
      {
        pluginId: "memory-core",
        register: mocks.memoryRegister,
        commands: ["memory"],
        source: "bundled",
      },
      {
        pluginId: "other",
        register: mocks.otherRegister,
        commands: ["other"],
        source: "bundled",
      },
    ],
  }),
}));

import { registerPluginCliCommands } from "./cli.js";

describe("registerPluginCliCommands", () => {
  beforeEach(() => {
    mocks.memoryRegister.mockClear();
    mocks.otherRegister.mockClear();
  });

  it("skips plugin CLI registrars when commands already exist", () => {
    const program = new Command();
    program.command("memory");

    registerPluginCliCommands(program, {} as any);

    expect(mocks.memoryRegister).not.toHaveBeenCalled();
    expect(mocks.otherRegister).toHaveBeenCalledTimes(1);
  });
});
