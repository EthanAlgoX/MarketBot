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

import { validateConfigObject } from "./config.js";
import { withTempHome } from "./test-helpers.js";

describe("identity avatar validation", () => {
  it("accepts workspace-relative avatar paths", async () => {
    await withTempHome(async (home) => {
      const workspace = path.join(home, "marketbot");
      const res = validateConfigObject({
        agents: {
          list: [{ id: "main", workspace, identity: { avatar: "avatars/marketbot.png" } }],
        },
      });
      expect(res.ok).toBe(true);
    });
  });

  it("accepts http(s) and data avatars", async () => {
    await withTempHome(async (home) => {
      const workspace = path.join(home, "marketbot");
      const httpRes = validateConfigObject({
        agents: {
          list: [{ id: "main", workspace, identity: { avatar: "https://example.com/avatar.png" } }],
        },
      });
      expect(httpRes.ok).toBe(true);

      const dataRes = validateConfigObject({
        agents: {
          list: [{ id: "main", workspace, identity: { avatar: "data:image/png;base64,AAA" } }],
        },
      });
      expect(dataRes.ok).toBe(true);
    });
  });

  it("rejects avatar paths outside workspace", async () => {
    await withTempHome(async (home) => {
      const workspace = path.join(home, "marketbot");
      const res = validateConfigObject({
        agents: {
          list: [{ id: "main", workspace, identity: { avatar: "../oops.png" } }],
        },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.issues[0]?.path).toBe("agents.list.0.identity.avatar");
      }
    });
  });
});
