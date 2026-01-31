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

import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const gatewayMocks = vi.hoisted(() => ({
  callGatewayFromCli: vi.fn(async () => ({
    ok: true,
    format: "ai",
    targetId: "t1",
    url: "https://example.com",
    snapshot: "ok",
  })),
}));

vi.mock("./gateway-rpc.js", () => ({
  callGatewayFromCli: gatewayMocks.callGatewayFromCli,
}));

const configMocks = vi.hoisted(() => ({
  loadConfig: vi.fn(() => ({ browser: {} })),
}));
vi.mock("../config/config.js", () => configMocks);

const sharedMocks = vi.hoisted(() => ({
  callBrowserRequest: vi.fn(
    async (_opts: unknown, params: { path?: string; query?: Record<string, unknown> }) => {
      const format = params.query?.format === "aria" ? "aria" : "ai";
      if (format === "aria") {
        return {
          ok: true,
          format: "aria",
          targetId: "t1",
          url: "https://example.com",
          nodes: [],
        };
      }
      return {
        ok: true,
        format: "ai",
        targetId: "t1",
        url: "https://example.com",
        snapshot: "ok",
      };
    },
  ),
}));
vi.mock("./browser-cli-shared.js", () => ({
  callBrowserRequest: sharedMocks.callBrowserRequest,
}));

const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
};
vi.mock("../runtime.js", () => ({
  defaultRuntime: runtime,
}));

describe("browser cli snapshot defaults", () => {
  afterEach(() => {
    vi.clearAllMocks();
    configMocks.loadConfig.mockReturnValue({ browser: {} });
  });

  it("uses config snapshot defaults when mode is not provided", async () => {
    configMocks.loadConfig.mockReturnValue({
      browser: { snapshotDefaults: { mode: "efficient" } },
    });

    const { registerBrowserInspectCommands } = await import("./browser-cli-inspect.js");
    const program = new Command();
    const browser = program.command("browser").option("--json", false);
    registerBrowserInspectCommands(browser, () => ({}));

    await program.parseAsync(["browser", "snapshot"], { from: "user" });

    expect(sharedMocks.callBrowserRequest).toHaveBeenCalled();
    const [, params] = sharedMocks.callBrowserRequest.mock.calls.at(-1) ?? [];
    expect(params?.path).toBe("/snapshot");
    expect(params?.query).toMatchObject({
      format: "ai",
      mode: "efficient",
    });
  });

  it("does not apply config snapshot defaults to aria snapshots", async () => {
    configMocks.loadConfig.mockReturnValue({
      browser: { snapshotDefaults: { mode: "efficient" } },
    });

    gatewayMocks.callGatewayFromCli.mockResolvedValueOnce({
      ok: true,
      format: "aria",
      targetId: "t1",
      url: "https://example.com",
      nodes: [],
    });

    const { registerBrowserInspectCommands } = await import("./browser-cli-inspect.js");
    const program = new Command();
    const browser = program.command("browser").option("--json", false);
    registerBrowserInspectCommands(browser, () => ({}));

    await program.parseAsync(["browser", "snapshot", "--format", "aria"], { from: "user" });

    expect(sharedMocks.callBrowserRequest).toHaveBeenCalled();
    const [, params] = sharedMocks.callBrowserRequest.mock.calls.at(-1) ?? [];
    expect(params?.path).toBe("/snapshot");
    expect((params?.query as { mode?: unknown } | undefined)?.mode).toBeUndefined();
  });
});
