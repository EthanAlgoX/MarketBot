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
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTempHome } from "./test-helpers.js";

describe("talk api key fallback", () => {
  let previousEnv: string | undefined;

  beforeEach(() => {
    previousEnv = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
  });

  afterEach(() => {
    process.env.ELEVENLABS_API_KEY = previousEnv;
  });

  it("injects talk.apiKey from profile when config is missing", async () => {
    await withTempHome(async (home) => {
      await fs.writeFile(
        path.join(home, ".profile"),
        "export ELEVENLABS_API_KEY=profile-key\n",
        "utf-8",
      );

      vi.resetModules();
      const { readConfigFileSnapshot } = await import("./config.js");
      const snap = await readConfigFileSnapshot();

      expect(snap.config?.talk?.apiKey).toBe("profile-key");
      expect(snap.exists).toBe(false);
    });
  });

  it("prefers ELEVENLABS_API_KEY env over profile", async () => {
    await withTempHome(async (home) => {
      await fs.writeFile(
        path.join(home, ".profile"),
        "export ELEVENLABS_API_KEY=profile-key\n",
        "utf-8",
      );
      process.env.ELEVENLABS_API_KEY = "env-key";

      vi.resetModules();
      const { readConfigFileSnapshot } = await import("./config.js");
      const snap = await readConfigFileSnapshot();

      expect(snap.config?.talk?.apiKey).toBe("env-key");
    });
  });
});
