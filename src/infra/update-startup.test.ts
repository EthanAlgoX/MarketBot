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

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UpdateCheckResult } from "./update-check.js";

vi.mock("./marketbot-root.js", () => ({
  resolveMarketBotPackageRoot: vi.fn(),
}));

vi.mock("./update-check.js", async () => {
  const actual = await vi.importActual<typeof import("./update-check.js")>("./update-check.js");
  return {
    ...actual,
    checkUpdateStatus: vi.fn(),
    fetchNpmTagVersion: vi.fn(),
    resolveNpmChannelTag: vi.fn(),
  };
});

vi.mock("../version.js", () => ({
  VERSION: "1.0.0",
}));

describe("update-startup", () => {
  const originalEnv = { ...process.env };
  let tempDir: string;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-17T10:00:00Z"));
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-update-check-"));
    process.env.MARKETBOT_STATE_DIR = tempDir;
    delete process.env.VITEST;
    process.env.NODE_ENV = "test";
  });

  afterEach(async () => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("logs update hint for npm installs when newer tag exists", async () => {
    const { resolveMarketBotPackageRoot } = await import("./marketbot-root.js");
    const { checkUpdateStatus, resolveNpmChannelTag } = await import("./update-check.js");
    const { runGatewayUpdateCheck } = await import("./update-startup.js");

    vi.mocked(resolveMarketBotPackageRoot).mockResolvedValue("/opt/marketbot");
    vi.mocked(checkUpdateStatus).mockResolvedValue({
      root: "/opt/marketbot",
      installKind: "package",
      packageManager: "npm",
    } satisfies UpdateCheckResult);
    vi.mocked(resolveNpmChannelTag).mockResolvedValue({
      tag: "latest",
      version: "2.0.0",
    });

    const log = { info: vi.fn() };
    await runGatewayUpdateCheck({
      cfg: { update: { channel: "stable" } },
      log,
      isNixMode: false,
      allowInTests: true,
    });

    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining("update available (latest): v2.0.0"),
    );

    const statePath = path.join(tempDir, "update-check.json");
    const raw = await fs.readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw) as { lastNotifiedVersion?: string };
    expect(parsed.lastNotifiedVersion).toBe("2.0.0");
  });

  it("uses latest when beta tag is older than release", async () => {
    const { resolveMarketBotPackageRoot } = await import("./marketbot-root.js");
    const { checkUpdateStatus, resolveNpmChannelTag } = await import("./update-check.js");
    const { runGatewayUpdateCheck } = await import("./update-startup.js");

    vi.mocked(resolveMarketBotPackageRoot).mockResolvedValue("/opt/marketbot");
    vi.mocked(checkUpdateStatus).mockResolvedValue({
      root: "/opt/marketbot",
      installKind: "package",
      packageManager: "npm",
    } satisfies UpdateCheckResult);
    vi.mocked(resolveNpmChannelTag).mockResolvedValue({
      tag: "latest",
      version: "2.0.0",
    });

    const log = { info: vi.fn() };
    await runGatewayUpdateCheck({
      cfg: { update: { channel: "beta" } },
      log,
      isNixMode: false,
      allowInTests: true,
    });

    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining("update available (latest): v2.0.0"),
    );

    const statePath = path.join(tempDir, "update-check.json");
    const raw = await fs.readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw) as { lastNotifiedTag?: string };
    expect(parsed.lastNotifiedTag).toBe("latest");
  });

  it("skips update check when disabled in config", async () => {
    const { runGatewayUpdateCheck } = await import("./update-startup.js");
    const log = { info: vi.fn() };

    await runGatewayUpdateCheck({
      cfg: { update: { checkOnStart: false } },
      log,
      isNixMode: false,
      allowInTests: true,
    });

    expect(log.info).not.toHaveBeenCalled();
    await expect(fs.stat(path.join(tempDir, "update-check.json"))).rejects.toThrow();
  });
});
