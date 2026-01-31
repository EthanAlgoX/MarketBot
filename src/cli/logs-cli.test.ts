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
import { afterEach, describe, expect, it, vi } from "vitest";

const callGatewayFromCli = vi.fn();

vi.mock("./gateway-rpc.js", async () => {
  const actual = await vi.importActual<typeof import("./gateway-rpc.js")>("./gateway-rpc.js");
  return {
    ...actual,
    callGatewayFromCli: (...args: unknown[]) => callGatewayFromCli(...args),
  };
});

describe("logs cli", () => {
  afterEach(() => {
    callGatewayFromCli.mockReset();
  });

  it("writes output directly to stdout/stderr", async () => {
    callGatewayFromCli.mockResolvedValueOnce({
      file: "/tmp/marketbot.log",
      cursor: 1,
      size: 123,
      lines: ["raw line"],
      truncated: true,
      reset: true,
    });

    const stdoutWrites: string[] = [];
    const stderrWrites: string[] = [];
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      stdoutWrites.push(String(chunk));
      return true;
    });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderrWrites.push(String(chunk));
      return true;
    });

    const { registerLogsCli } = await import("./logs-cli.js");
    const program = new Command();
    program.exitOverride();
    registerLogsCli(program);

    await program.parseAsync(["logs"], { from: "user" });

    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();

    expect(stdoutWrites.join("")).toContain("Log file:");
    expect(stdoutWrites.join("")).toContain("raw line");
    expect(stderrWrites.join("")).toContain("Log tail truncated");
    expect(stderrWrites.join("")).toContain("Log cursor reset");
  });

  it("warns when the output pipe closes", async () => {
    callGatewayFromCli.mockResolvedValueOnce({
      file: "/tmp/marketbot.log",
      lines: ["line one"],
    });

    const stderrWrites: string[] = [];
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => {
      const err = new Error("EPIPE") as NodeJS.ErrnoException;
      err.code = "EPIPE";
      throw err;
    });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderrWrites.push(String(chunk));
      return true;
    });

    const { registerLogsCli } = await import("./logs-cli.js");
    const program = new Command();
    program.exitOverride();
    registerLogsCli(program);

    await program.parseAsync(["logs"], { from: "user" });

    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();

    expect(stderrWrites.join("")).toContain("output stdout closed");
  });
});
