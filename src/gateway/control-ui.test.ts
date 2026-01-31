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

import {
  buildControlUiAvatarUrl,
  normalizeControlUiBasePath,
  resolveAssistantAvatarUrl,
} from "./control-ui-shared.js";

describe("resolveAssistantAvatarUrl", () => {
  it("normalizes base paths", () => {
    expect(normalizeControlUiBasePath()).toBe("");
    expect(normalizeControlUiBasePath("")).toBe("");
    expect(normalizeControlUiBasePath(" ")).toBe("");
    expect(normalizeControlUiBasePath("/")).toBe("");
    expect(normalizeControlUiBasePath("ui")).toBe("/ui");
    expect(normalizeControlUiBasePath("/ui/")).toBe("/ui");
  });

  it("builds avatar URLs", () => {
    expect(buildControlUiAvatarUrl("", "main")).toBe("/avatar/main");
    expect(buildControlUiAvatarUrl("/ui", "main")).toBe("/ui/avatar/main");
  });

  it("keeps remote and data URLs", () => {
    expect(
      resolveAssistantAvatarUrl({
        avatar: "https://example.com/avatar.png",
        agentId: "main",
        basePath: "/ui",
      }),
    ).toBe("https://example.com/avatar.png");
    expect(
      resolveAssistantAvatarUrl({
        avatar: "data:image/png;base64,abc",
        agentId: "main",
        basePath: "/ui",
      }),
    ).toBe("data:image/png;base64,abc");
  });

  it("prefixes basePath for /avatar endpoints", () => {
    expect(
      resolveAssistantAvatarUrl({
        avatar: "/avatar/main",
        agentId: "main",
        basePath: "/ui",
      }),
    ).toBe("/ui/avatar/main");
    expect(
      resolveAssistantAvatarUrl({
        avatar: "/ui/avatar/main",
        agentId: "main",
        basePath: "/ui",
      }),
    ).toBe("/ui/avatar/main");
  });

  it("maps local avatar paths to the avatar endpoint", () => {
    expect(
      resolveAssistantAvatarUrl({
        avatar: "avatars/me.png",
        agentId: "main",
        basePath: "/ui",
      }),
    ).toBe("/ui/avatar/main");
    expect(
      resolveAssistantAvatarUrl({
        avatar: "avatars/profile",
        agentId: "main",
        basePath: "/ui",
      }),
    ).toBe("/ui/avatar/main");
  });

  it("leaves local paths untouched when agentId is missing", () => {
    expect(
      resolveAssistantAvatarUrl({
        avatar: "avatars/me.png",
        basePath: "/ui",
      }),
    ).toBe("avatars/me.png");
  });

  it("keeps short text avatars", () => {
    expect(
      resolveAssistantAvatarUrl({
        avatar: "PS",
        agentId: "main",
        basePath: "/ui",
      }),
    ).toBe("PS");
  });
});
