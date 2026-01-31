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

import { describe, expect, it } from "vitest";

import { deriveSessionMetaPatch } from "./metadata.js";

describe("deriveSessionMetaPatch", () => {
  it("captures origin + group metadata", () => {
    const patch = deriveSessionMetaPatch({
      ctx: {
        Provider: "whatsapp",
        ChatType: "group",
        GroupSubject: "Family",
        From: "123@g.us",
      },
      sessionKey: "agent:main:whatsapp:group:123@g.us",
    });

    expect(patch?.origin?.label).toBe("Family id:123@g.us");
    expect(patch?.origin?.provider).toBe("whatsapp");
    expect(patch?.subject).toBe("Family");
    expect(patch?.channel).toBe("whatsapp");
    expect(patch?.groupId).toBe("123@g.us");
  });
});
