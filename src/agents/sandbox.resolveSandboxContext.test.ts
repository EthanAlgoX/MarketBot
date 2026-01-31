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
import type { MarketBotConfig } from "../config/config.js";

describe("resolveSandboxContext", () => {
  it("does not sandbox the agent main session in non-main mode", async () => {
    vi.resetModules();

    const spawn = vi.fn(() => {
      throw new Error("spawn should not be called");
    });
    vi.doMock("node:child_process", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:child_process")>();
      return { ...actual, spawn };
    });

    const { resolveSandboxContext } = await import("./sandbox.js");

    const cfg: MarketBotConfig = {
      agents: {
        defaults: {
          sandbox: { mode: "non-main", scope: "session" },
        },
        list: [{ id: "main" }],
      },
    };

    const result = await resolveSandboxContext({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir: "/tmp/marketbot-test",
    });

    expect(result).toBeNull();
    expect(spawn).not.toHaveBeenCalled();

    vi.doUnmock("node:child_process");
  }, 15_000);

  it("does not create a sandbox workspace for the agent main session in non-main mode", async () => {
    vi.resetModules();

    const spawn = vi.fn(() => {
      throw new Error("spawn should not be called");
    });
    vi.doMock("node:child_process", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:child_process")>();
      return { ...actual, spawn };
    });

    const { ensureSandboxWorkspaceForSession } = await import("./sandbox.js");

    const cfg: MarketBotConfig = {
      agents: {
        defaults: {
          sandbox: { mode: "non-main", scope: "session" },
        },
        list: [{ id: "main" }],
      },
    };

    const result = await ensureSandboxWorkspaceForSession({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir: "/tmp/marketbot-test",
    });

    expect(result).toBeNull();
    expect(spawn).not.toHaveBeenCalled();

    vi.doUnmock("node:child_process");
  }, 15_000);

  it("treats main session aliases as main in non-main mode", async () => {
    vi.resetModules();

    const spawn = vi.fn(() => {
      throw new Error("spawn should not be called");
    });
    vi.doMock("node:child_process", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:child_process")>();
      return { ...actual, spawn };
    });

    const { ensureSandboxWorkspaceForSession, resolveSandboxContext } =
      await import("./sandbox.js");

    const cfg: MarketBotConfig = {
      session: { mainKey: "work" },
      agents: {
        defaults: {
          sandbox: { mode: "non-main", scope: "session" },
        },
        list: [{ id: "main" }],
      },
    };

    expect(
      await resolveSandboxContext({
        config: cfg,
        sessionKey: "main",
        workspaceDir: "/tmp/marketbot-test",
      }),
    ).toBeNull();

    expect(
      await resolveSandboxContext({
        config: cfg,
        sessionKey: "agent:main:main",
        workspaceDir: "/tmp/marketbot-test",
      }),
    ).toBeNull();

    expect(
      await ensureSandboxWorkspaceForSession({
        config: cfg,
        sessionKey: "work",
        workspaceDir: "/tmp/marketbot-test",
      }),
    ).toBeNull();

    expect(
      await ensureSandboxWorkspaceForSession({
        config: cfg,
        sessionKey: "agent:main:main",
        workspaceDir: "/tmp/marketbot-test",
      }),
    ).toBeNull();

    expect(spawn).not.toHaveBeenCalled();

    vi.doUnmock("node:child_process");
  }, 15_000);
});
