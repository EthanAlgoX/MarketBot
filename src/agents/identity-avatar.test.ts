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

import { describe, expect, it } from "vitest";

import type { MarketBotConfig } from "../config/config.js";
import { resolveAgentAvatar } from "./identity-avatar.js";

async function writeFile(filePath: string, contents = "avatar") {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf-8");
}

describe("resolveAgentAvatar", () => {
  it("resolves local avatar from config when inside workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-avatar-"));
    const workspace = path.join(root, "work");
    const avatarPath = path.join(workspace, "avatars", "main.png");
    await writeFile(avatarPath);

    const cfg: MarketBotConfig = {
      agents: {
        list: [
          {
            id: "main",
            workspace,
            identity: { avatar: "avatars/main.png" },
          },
        ],
      },
    };

    const workspaceReal = await fs.realpath(workspace);
    const resolved = resolveAgentAvatar(cfg, "main");
    expect(resolved.kind).toBe("local");
    if (resolved.kind === "local") {
      const resolvedReal = await fs.realpath(resolved.filePath);
      expect(path.relative(workspaceReal, resolvedReal)).toBe(path.join("avatars", "main.png"));
    }
  });

  it("rejects avatars outside the workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-avatar-"));
    const workspace = path.join(root, "work");
    await fs.mkdir(workspace, { recursive: true });
    const outsidePath = path.join(root, "outside.png");
    await writeFile(outsidePath);

    const cfg: MarketBotConfig = {
      agents: {
        list: [
          {
            id: "main",
            workspace,
            identity: { avatar: outsidePath },
          },
        ],
      },
    };

    const resolved = resolveAgentAvatar(cfg, "main");
    expect(resolved.kind).toBe("none");
    if (resolved.kind === "none") {
      expect(resolved.reason).toBe("outside_workspace");
    }
  });

  it("falls back to IDENTITY.md when config has no avatar", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-avatar-"));
    const workspace = path.join(root, "work");
    const avatarPath = path.join(workspace, "avatars", "fallback.png");
    await writeFile(avatarPath);
    await fs.mkdir(workspace, { recursive: true });
    await fs.writeFile(
      path.join(workspace, "IDENTITY.md"),
      "- Avatar: avatars/fallback.png\n",
      "utf-8",
    );

    const cfg: MarketBotConfig = {
      agents: {
        list: [{ id: "main", workspace }],
      },
    };

    const workspaceReal = await fs.realpath(workspace);
    const resolved = resolveAgentAvatar(cfg, "main");
    expect(resolved.kind).toBe("local");
    if (resolved.kind === "local") {
      const resolvedReal = await fs.realpath(resolved.filePath);
      expect(path.relative(workspaceReal, resolvedReal)).toBe(path.join("avatars", "fallback.png"));
    }
  });

  it("accepts remote and data avatars", () => {
    const cfg: MarketBotConfig = {
      agents: {
        list: [
          { id: "main", identity: { avatar: "https://example.com/avatar.png" } },
          { id: "data", identity: { avatar: "data:image/png;base64,aaaa" } },
        ],
      },
    };

    const remote = resolveAgentAvatar(cfg, "main");
    expect(remote.kind).toBe("remote");

    const data = resolveAgentAvatar(cfg, "data");
    expect(data.kind).toBe("data");
  });
});
