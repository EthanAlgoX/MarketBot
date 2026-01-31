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
import { describe, expect, it } from "vitest";
import {
  buildMinimalServicePath,
  buildNodeServiceEnvironment,
  buildServiceEnvironment,
  getMinimalServicePathParts,
  getMinimalServicePathPartsFromEnv,
} from "./service-env.js";

describe("getMinimalServicePathParts - Linux user directories", () => {
  it("includes user bin directories when HOME is set on Linux", () => {
    const result = getMinimalServicePathParts({
      platform: "linux",
      home: "/home/testuser",
    });

    // Should include all common user bin directories
    expect(result).toContain("/home/testuser/.local/bin");
    expect(result).toContain("/home/testuser/.npm-global/bin");
    expect(result).toContain("/home/testuser/bin");
    expect(result).toContain("/home/testuser/.nvm/current/bin");
    expect(result).toContain("/home/testuser/.fnm/current/bin");
    expect(result).toContain("/home/testuser/.volta/bin");
    expect(result).toContain("/home/testuser/.asdf/shims");
    expect(result).toContain("/home/testuser/.local/share/pnpm");
    expect(result).toContain("/home/testuser/.bun/bin");
  });

  it("excludes user bin directories when HOME is undefined on Linux", () => {
    const result = getMinimalServicePathParts({
      platform: "linux",
      home: undefined,
    });

    // Should only include system directories
    expect(result).toEqual(["/usr/local/bin", "/usr/bin", "/bin"]);

    // Should not include any user-specific paths
    expect(result.some((p) => p.includes(".local"))).toBe(false);
    expect(result.some((p) => p.includes(".npm-global"))).toBe(false);
    expect(result.some((p) => p.includes(".nvm"))).toBe(false);
  });

  it("places user directories before system directories on Linux", () => {
    const result = getMinimalServicePathParts({
      platform: "linux",
      home: "/home/testuser",
    });

    const userDirIndex = result.indexOf("/home/testuser/.local/bin");
    const systemDirIndex = result.indexOf("/usr/bin");

    expect(userDirIndex).toBeGreaterThan(-1);
    expect(systemDirIndex).toBeGreaterThan(-1);
    expect(userDirIndex).toBeLessThan(systemDirIndex);
  });

  it("places extraDirs before user directories on Linux", () => {
    const result = getMinimalServicePathParts({
      platform: "linux",
      home: "/home/testuser",
      extraDirs: ["/custom/bin"],
    });

    const extraDirIndex = result.indexOf("/custom/bin");
    const userDirIndex = result.indexOf("/home/testuser/.local/bin");

    expect(extraDirIndex).toBeGreaterThan(-1);
    expect(userDirIndex).toBeGreaterThan(-1);
    expect(extraDirIndex).toBeLessThan(userDirIndex);
  });

  it("includes env-configured bin roots when HOME is set on Linux", () => {
    const result = getMinimalServicePathPartsFromEnv({
      platform: "linux",
      env: {
        HOME: "/home/testuser",
        PNPM_HOME: "/opt/pnpm",
        NPM_CONFIG_PREFIX: "/opt/npm",
        BUN_INSTALL: "/opt/bun",
        VOLTA_HOME: "/opt/volta",
        ASDF_DATA_DIR: "/opt/asdf",
        NVM_DIR: "/opt/nvm",
        FNM_DIR: "/opt/fnm",
      },
    });

    expect(result).toContain("/opt/pnpm");
    expect(result).toContain("/opt/npm/bin");
    expect(result).toContain("/opt/bun/bin");
    expect(result).toContain("/opt/volta/bin");
    expect(result).toContain("/opt/asdf/shims");
    expect(result).toContain("/opt/nvm/current/bin");
    expect(result).toContain("/opt/fnm/current/bin");
  });

  it("does not include Linux user directories on macOS", () => {
    const result = getMinimalServicePathParts({
      platform: "darwin",
      home: "/Users/testuser",
    });

    // Should not include Linux-specific user dirs even with HOME set
    expect(result.some((p) => p.includes(".npm-global"))).toBe(false);
    expect(result.some((p) => p.includes(".nvm"))).toBe(false);

    // Should only include macOS system directories
    expect(result).toContain("/opt/homebrew/bin");
    expect(result).toContain("/usr/local/bin");
  });

  it("does not include Linux user directories on Windows", () => {
    const result = getMinimalServicePathParts({
      platform: "win32",
      home: "C:\\Users\\testuser",
    });

    // Windows returns empty array (uses existing PATH)
    expect(result).toEqual([]);
  });
});

describe("buildMinimalServicePath", () => {
  const splitPath = (value: string, platform: NodeJS.Platform) =>
    value.split(platform === "win32" ? path.win32.delimiter : path.posix.delimiter);

  it("includes Homebrew + system dirs on macOS", () => {
    const result = buildMinimalServicePath({
      platform: "darwin",
    });
    const parts = splitPath(result, "darwin");
    expect(parts).toContain("/opt/homebrew/bin");
    expect(parts).toContain("/usr/local/bin");
    expect(parts).toContain("/usr/bin");
    expect(parts).toContain("/bin");
  });

  it("returns PATH as-is on Windows", () => {
    const result = buildMinimalServicePath({
      env: { PATH: "C:\\\\Windows\\\\System32" },
      platform: "win32",
    });
    expect(result).toBe("C:\\\\Windows\\\\System32");
  });

  it("includes Linux user directories when HOME is set in env", () => {
    const result = buildMinimalServicePath({
      platform: "linux",
      env: { HOME: "/home/alice" },
    });
    const parts = splitPath(result, "linux");

    // Verify user directories are included
    expect(parts).toContain("/home/alice/.local/bin");
    expect(parts).toContain("/home/alice/.npm-global/bin");
    expect(parts).toContain("/home/alice/.nvm/current/bin");

    // Verify system directories are also included
    expect(parts).toContain("/usr/local/bin");
    expect(parts).toContain("/usr/bin");
    expect(parts).toContain("/bin");
  });

  it("excludes Linux user directories when HOME is not in env", () => {
    const result = buildMinimalServicePath({
      platform: "linux",
      env: {},
    });
    const parts = splitPath(result, "linux");

    // Should only have system directories
    expect(parts).toEqual(["/usr/local/bin", "/usr/bin", "/bin"]);

    // No user-specific paths
    expect(parts.some((p) => p.includes("home"))).toBe(false);
  });

  it("ensures user directories come before system directories on Linux", () => {
    const result = buildMinimalServicePath({
      platform: "linux",
      env: { HOME: "/home/bob" },
    });
    const parts = splitPath(result, "linux");

    const firstUserDirIdx = parts.indexOf("/home/bob/.local/bin");
    const firstSystemDirIdx = parts.indexOf("/usr/local/bin");

    expect(firstUserDirIdx).toBeLessThan(firstSystemDirIdx);
  });

  it("includes extra directories when provided", () => {
    const result = buildMinimalServicePath({
      platform: "linux",
      extraDirs: ["/custom/tools"],
      env: {},
    });
    expect(splitPath(result, "linux")).toContain("/custom/tools");
  });

  it("deduplicates directories", () => {
    const result = buildMinimalServicePath({
      platform: "linux",
      extraDirs: ["/usr/bin"],
      env: {},
    });
    const parts = splitPath(result, "linux");
    const unique = [...new Set(parts)];
    expect(parts.length).toBe(unique.length);
  });
});

describe("buildServiceEnvironment", () => {
  it("sets minimal PATH and gateway vars", () => {
    const env = buildServiceEnvironment({
      env: { HOME: "/home/user" },
      port: 18789,
      token: "secret",
    });
    expect(env.HOME).toBe("/home/user");
    if (process.platform === "win32") {
      expect(env.PATH).toBe("");
    } else {
      expect(env.PATH).toContain("/usr/bin");
    }
    expect(env.MARKETBOT_GATEWAY_PORT).toBe("18789");
    expect(env.MARKETBOT_GATEWAY_TOKEN).toBe("secret");
    expect(env.MARKETBOT_SERVICE_MARKER).toBe("marketbot");
    expect(env.MARKETBOT_SERVICE_KIND).toBe("gateway");
    expect(typeof env.MARKETBOT_SERVICE_VERSION).toBe("string");
    expect(env.MARKETBOT_SYSTEMD_UNIT).toBe("marketbot-gateway.service");
    if (process.platform === "darwin") {
      expect(env.MARKETBOT_LAUNCHD_LABEL).toBe("ai.marketbot.gateway");
    }
  });

  it("uses profile-specific unit and label", () => {
    const env = buildServiceEnvironment({
      env: { HOME: "/home/user", MARKETBOT_PROFILE: "work" },
      port: 18789,
    });
    expect(env.MARKETBOT_SYSTEMD_UNIT).toBe("marketbot-gateway-work.service");
    if (process.platform === "darwin") {
      expect(env.MARKETBOT_LAUNCHD_LABEL).toBe("ai.marketbot.work");
    }
  });
});

describe("buildNodeServiceEnvironment", () => {
  it("passes through HOME for node services", () => {
    const env = buildNodeServiceEnvironment({
      env: { HOME: "/home/user" },
    });
    expect(env.HOME).toBe("/home/user");
  });
});
