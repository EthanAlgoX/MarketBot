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

import { describe, expect, it, vi } from "vitest";

import type { runExec } from "../process/exec.js";
import type { RuntimeEnv } from "../runtime.js";
import { ensureBinary } from "./binaries.js";

describe("ensureBinary", () => {
  it("passes through when binary exists", async () => {
    const exec: typeof runExec = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "",
    });
    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    await ensureBinary("node", exec, runtime);
    expect(exec).toHaveBeenCalledWith("which", ["node"]);
  });

  it("logs and exits when missing", async () => {
    const exec: typeof runExec = vi.fn().mockRejectedValue(new Error("missing"));
    const error = vi.fn();
    const exit = vi.fn(() => {
      throw new Error("exit");
    });
    await expect(ensureBinary("ghost", exec, { log: vi.fn(), error, exit })).rejects.toThrow(
      "exit",
    );
    expect(error).toHaveBeenCalledWith("Missing required binary: ghost. Please install it.");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
