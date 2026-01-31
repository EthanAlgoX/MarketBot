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

describe("config msteams", () => {
  it("accepts replyStyle at global/team/channel levels", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      channels: {
        msteams: {
          replyStyle: "top-level",
          teams: {
            team123: {
              replyStyle: "thread",
              channels: {
                chan456: { replyStyle: "top-level" },
              },
            },
          },
        },
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config.channels?.msteams?.replyStyle).toBe("top-level");
      expect(res.config.channels?.msteams?.teams?.team123?.replyStyle).toBe("thread");
      expect(res.config.channels?.msteams?.teams?.team123?.channels?.chan456?.replyStyle).toBe(
        "top-level",
      );
    }
  });

  it("rejects invalid replyStyle", async () => {
    vi.resetModules();
    const { validateConfigObject } = await import("./config.js");
    const res = validateConfigObject({
      channels: { msteams: { replyStyle: "nope" } },
    });
    expect(res.ok).toBe(false);
  });
});
