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
import { describe, expect, it, vi } from "vitest";

import {
  resolveDefaultConfigCandidates,
  resolveConfigPath,
  resolveOAuthDir,
  resolveOAuthPath,
  resolveStateDir,
} from "./paths.js";

describe("oauth paths", () => {
  it("prefers MARKETBOT_OAUTH_DIR over MARKETBOT_STATE_DIR", () => {
    const env = {
      MARKETBOT_OAUTH_DIR: "/custom/oauth",
      MARKETBOT_STATE_DIR: "/custom/state",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.resolve("/custom/oauth"));
    expect(resolveOAuthPath(env, "/custom/state")).toBe(
      path.join(path.resolve("/custom/oauth"), "oauth.json"),
    );
  });

  it("derives oauth path from MARKETBOT_STATE_DIR when unset", () => {
    const env = {
      MARKETBOT_STATE_DIR: "/custom/state",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.join("/custom/state", "credentials"));
    expect(resolveOAuthPath(env, "/custom/state")).toBe(
      path.join("/custom/state", "credentials", "oauth.json"),
    );
  });
});

describe("state + config path candidates", () => {
  it("uses MARKETBOT_STATE_DIR when set", () => {
    const env = {
      MARKETBOT_STATE_DIR: "/new/state",
    } as NodeJS.ProcessEnv;

    expect(resolveStateDir(env, () => "/home/test")).toBe(path.resolve("/new/state"));
  });

  it("orders default config candidates in a stable order", () => {
    const home = "/home/test";
    const candidates = resolveDefaultConfigCandidates({} as NodeJS.ProcessEnv, () => home);
    const expected = [
      path.join(home, ".marketbot", "marketbot.json"),
      path.join(home, ".marketbot", "marketbotbot.json"),
      path.join(home, ".marketbot", "marketbot.json"),
      path.join(home, ".marketbot", "moldbot.json"),
      path.join(home, ".marketbotbot", "marketbot.json"),
      path.join(home, ".marketbotbot", "marketbotbot.json"),
      path.join(home, ".marketbotbot", "marketbot.json"),
      path.join(home, ".marketbotbot", "moldbot.json"),
      path.join(home, ".marketbot", "marketbot.json"),
      path.join(home, ".marketbot", "marketbotbot.json"),
      path.join(home, ".marketbot", "marketbot.json"),
      path.join(home, ".marketbot", "moldbot.json"),
      path.join(home, ".moldbot", "marketbot.json"),
      path.join(home, ".moldbot", "marketbotbot.json"),
      path.join(home, ".moldbot", "marketbot.json"),
      path.join(home, ".moldbot", "moldbot.json"),
    ];
    expect(candidates).toEqual(expected);
  });

  it("prefers ~/.marketbot when it exists and legacy dir is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-state-"));
    try {
      const newDir = path.join(root, ".marketbot");
      await fs.mkdir(newDir, { recursive: true });
      const resolved = resolveStateDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("CONFIG_PATH prefers existing config when present", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-config-"));
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    const previousHomeDrive = process.env.HOMEDRIVE;
    const previousHomePath = process.env.HOMEPATH;
    const previousMarketBotConfig = process.env.MARKETBOT_CONFIG_PATH;
    const previousMarketBotState = process.env.MARKETBOT_STATE_DIR;
    try {
      const legacyDir = path.join(root, ".marketbot");
      await fs.mkdir(legacyDir, { recursive: true });
      const legacyPath = path.join(legacyDir, "marketbot.json");
      await fs.writeFile(legacyPath, "{}", "utf-8");

      process.env.HOME = root;
      if (process.platform === "win32") {
        process.env.USERPROFILE = root;
        const parsed = path.win32.parse(root);
        process.env.HOMEDRIVE = parsed.root.replace(/\\$/, "");
        process.env.HOMEPATH = root.slice(parsed.root.length - 1);
      }
      delete process.env.MARKETBOT_CONFIG_PATH;
      delete process.env.MARKETBOT_STATE_DIR;

      vi.resetModules();
      const { CONFIG_PATH } = await import("./paths.js");
      expect(CONFIG_PATH).toBe(legacyPath);
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      if (previousUserProfile === undefined) {
        delete process.env.USERPROFILE;
      } else {
        process.env.USERPROFILE = previousUserProfile;
      }
      if (previousHomeDrive === undefined) {
        delete process.env.HOMEDRIVE;
      } else {
        process.env.HOMEDRIVE = previousHomeDrive;
      }
      if (previousHomePath === undefined) {
        delete process.env.HOMEPATH;
      } else {
        process.env.HOMEPATH = previousHomePath;
      }
      if (previousMarketBotConfig === undefined) {
        delete process.env.MARKETBOT_CONFIG_PATH;
      } else {
        process.env.MARKETBOT_CONFIG_PATH = previousMarketBotConfig;
      }
      if (previousMarketBotConfig === undefined) {
        delete process.env.MARKETBOT_CONFIG_PATH;
      } else {
        process.env.MARKETBOT_CONFIG_PATH = previousMarketBotConfig;
      }
      if (previousMarketBotState === undefined) {
        delete process.env.MARKETBOT_STATE_DIR;
      } else {
        process.env.MARKETBOT_STATE_DIR = previousMarketBotState;
      }
      if (previousMarketBotState === undefined) {
        delete process.env.MARKETBOT_STATE_DIR;
      } else {
        process.env.MARKETBOT_STATE_DIR = previousMarketBotState;
      }
      await fs.rm(root, { recursive: true, force: true });
      vi.resetModules();
    }
  });

  it("respects state dir overrides when config is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-config-override-"));
    try {
      const legacyDir = path.join(root, ".marketbot");
      await fs.mkdir(legacyDir, { recursive: true });
      const legacyConfig = path.join(legacyDir, "marketbot.json");
      await fs.writeFile(legacyConfig, "{}", "utf-8");

      const overrideDir = path.join(root, "override");
      const env = { MARKETBOT_STATE_DIR: overrideDir } as NodeJS.ProcessEnv;
      const resolved = resolveConfigPath(env, overrideDir, () => root);
      expect(resolved).toBe(path.join(overrideDir, "marketbot.json"));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
