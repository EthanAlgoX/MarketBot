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
import { basename, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";
import type { MsgContext, TemplateContext } from "./templating.js";

const sandboxMocks = vi.hoisted(() => ({
  ensureSandboxWorkspaceForSession: vi.fn(),
}));

vi.mock("../agents/sandbox.js", () => sandboxMocks);

import { ensureSandboxWorkspaceForSession } from "../agents/sandbox.js";
import { stageSandboxMedia } from "./reply/stage-sandbox-media.js";

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(async (home) => await fn(home), { prefix: "marketbot-triggers-" });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stageSandboxMedia", () => {
  it("stages inbound media into the sandbox workspace", async () => {
    await withTempHome(async (home) => {
      const inboundDir = join(home, ".marketbot", "media", "inbound");
      await fs.mkdir(inboundDir, { recursive: true });
      const mediaPath = join(inboundDir, "photo.jpg");
      await fs.writeFile(mediaPath, "test");

      const sandboxDir = join(home, "sandboxes", "session");
      vi.mocked(ensureSandboxWorkspaceForSession).mockResolvedValue({
        workspaceDir: sandboxDir,
        containerWorkdir: "/work",
      });

      const ctx: MsgContext = {
        Body: "hi",
        From: "whatsapp:group:demo",
        To: "+2000",
        ChatType: "group",
        Provider: "whatsapp",
        MediaPath: mediaPath,
        MediaType: "image/jpeg",
        MediaUrl: mediaPath,
      };
      const sessionCtx: TemplateContext = { ...ctx };

      await stageSandboxMedia({
        ctx,
        sessionCtx,
        cfg: {
          agents: {
            defaults: {
              model: "anthropic/claude-opus-4-5",
              workspace: join(home, "marketbot"),
              sandbox: {
                mode: "non-main",
                workspaceRoot: join(home, "sandboxes"),
              },
            },
          },
          channels: { whatsapp: { allowFrom: ["*"] } },
          session: { store: join(home, "sessions.json") },
        },
        sessionKey: "agent:main:main",
        workspaceDir: join(home, "marketbot"),
      });

      const stagedPath = `media/inbound/${basename(mediaPath)}`;
      expect(ctx.MediaPath).toBe(stagedPath);
      expect(sessionCtx.MediaPath).toBe(stagedPath);
      expect(ctx.MediaUrl).toBe(stagedPath);
      expect(sessionCtx.MediaUrl).toBe(stagedPath);

      const stagedFullPath = join(sandboxDir, "media", "inbound", basename(mediaPath));
      await expect(fs.stat(stagedFullPath)).resolves.toBeTruthy();
    });
  });
});
