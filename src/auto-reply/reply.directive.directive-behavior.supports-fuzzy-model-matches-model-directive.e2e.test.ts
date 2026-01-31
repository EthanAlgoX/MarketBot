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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";
import { loadModelCatalog } from "../agents/model-catalog.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { loadSessionStore } from "../config/sessions.js";
import { getReplyFromConfig } from "./reply.js";

const MAIN_SESSION_KEY = "agent:main:main";

vi.mock("../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: vi.fn(),
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key: string) => `session:${key.trim() || "main"}`,
  isEmbeddedPiRunActive: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunStreaming: vi.fn().mockReturnValue(false),
}));
vi.mock("../agents/model-catalog.js", () => ({
  loadModelCatalog: vi.fn(),
}));

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(
    async (home) => {
      return await fn(home);
    },
    {
      env: {
        MARKETBOT_AGENT_DIR: (home) => path.join(home, ".marketbot", "agent"),
        PI_CODING_AGENT_DIR: (home) => path.join(home, ".marketbot", "agent"),
      },
      prefix: "marketbot-reply-",
    },
  );
}

function assertModelSelection(
  storePath: string,
  selection: { model?: string; provider?: string } = {},
) {
  const store = loadSessionStore(storePath);
  const entry = store[MAIN_SESSION_KEY];
  expect(entry).toBeDefined();
  expect(entry?.modelOverride).toBe(selection.model);
  expect(entry?.providerOverride).toBe(selection.provider);
}

describe("directive behavior", () => {
  beforeEach(() => {
    vi.mocked(runEmbeddedPiAgent).mockReset();
    vi.mocked(loadModelCatalog).mockResolvedValue([
      { id: "claude-opus-4-5", name: "Opus 4.5", provider: "anthropic" },
      { id: "claude-sonnet-4-1", name: "Sonnet 4.1", provider: "anthropic" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai" },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("supports fuzzy model matches on /model directive", async () => {
    await withTempHome(async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockReset();
      const storePath = path.join(home, "sessions.json");

      const res = await getReplyFromConfig(
        { Body: "/model kimi", From: "+1222", To: "+1222", CommandAuthorized: true },
        {},
        {
          agents: {
            defaults: {
              model: { primary: "anthropic/claude-opus-4-5" },
              workspace: path.join(home, "marketbot"),
              models: {
                "anthropic/claude-opus-4-5": {},
                "moonshot/kimi-k2-0905-preview": {},
              },
            },
          },
          models: {
            mode: "merge",
            providers: {
              moonshot: {
                baseUrl: "https://api.moonshot.ai/v1",
                apiKey: "sk-test",
                api: "openai-completions",
                models: [{ id: "kimi-k2-0905-preview", name: "Kimi K2" }],
              },
            },
          },
          session: { store: storePath },
        },
      );

      const text = Array.isArray(res) ? res[0]?.text : res?.text;
      expect(text).toContain("Model set to moonshot/kimi-k2-0905-preview.");
      assertModelSelection(storePath, {
        provider: "moonshot",
        model: "kimi-k2-0905-preview",
      });
      expect(runEmbeddedPiAgent).not.toHaveBeenCalled();
    });
  });
  it("resolves provider-less exact model ids via fuzzy matching when unambiguous", async () => {
    await withTempHome(async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockReset();
      const storePath = path.join(home, "sessions.json");

      const res = await getReplyFromConfig(
        {
          Body: "/model kimi-k2-0905-preview",
          From: "+1222",
          To: "+1222",
          CommandAuthorized: true,
        },
        {},
        {
          agents: {
            defaults: {
              model: { primary: "anthropic/claude-opus-4-5" },
              workspace: path.join(home, "marketbot"),
              models: {
                "anthropic/claude-opus-4-5": {},
                "moonshot/kimi-k2-0905-preview": {},
              },
            },
          },
          models: {
            mode: "merge",
            providers: {
              moonshot: {
                baseUrl: "https://api.moonshot.ai/v1",
                apiKey: "sk-test",
                api: "openai-completions",
                models: [{ id: "kimi-k2-0905-preview", name: "Kimi K2" }],
              },
            },
          },
          session: { store: storePath },
        },
      );

      const text = Array.isArray(res) ? res[0]?.text : res?.text;
      expect(text).toContain("Model set to moonshot/kimi-k2-0905-preview.");
      assertModelSelection(storePath, {
        provider: "moonshot",
        model: "kimi-k2-0905-preview",
      });
      expect(runEmbeddedPiAgent).not.toHaveBeenCalled();
    });
  });
  it("supports fuzzy matches within a provider on /model provider/model", async () => {
    await withTempHome(async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockReset();
      const storePath = path.join(home, "sessions.json");

      const res = await getReplyFromConfig(
        { Body: "/model moonshot/kimi", From: "+1222", To: "+1222", CommandAuthorized: true },
        {},
        {
          agents: {
            defaults: {
              model: { primary: "anthropic/claude-opus-4-5" },
              workspace: path.join(home, "marketbot"),
              models: {
                "anthropic/claude-opus-4-5": {},
                "moonshot/kimi-k2-0905-preview": {},
              },
            },
          },
          models: {
            mode: "merge",
            providers: {
              moonshot: {
                baseUrl: "https://api.moonshot.ai/v1",
                apiKey: "sk-test",
                api: "openai-completions",
                models: [{ id: "kimi-k2-0905-preview", name: "Kimi K2" }],
              },
            },
          },
          session: { store: storePath },
        },
      );

      const text = Array.isArray(res) ? res[0]?.text : res?.text;
      expect(text).toContain("Model set to moonshot/kimi-k2-0905-preview.");
      assertModelSelection(storePath, {
        provider: "moonshot",
        model: "kimi-k2-0905-preview",
      });
      expect(runEmbeddedPiAgent).not.toHaveBeenCalled();
    });
  });
  it("picks the best fuzzy match when multiple models match", async () => {
    await withTempHome(async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockReset();
      const storePath = path.join(home, "sessions.json");

      await getReplyFromConfig(
        { Body: "/model minimax", From: "+1222", To: "+1222", CommandAuthorized: true },
        {},
        {
          agents: {
            defaults: {
              model: { primary: "minimax/MiniMax-M2.1" },
              workspace: path.join(home, "marketbot"),
              models: {
                "minimax/MiniMax-M2.1": {},
                "minimax/MiniMax-M2.1-lightning": {},
                "lmstudio/minimax-m2.1-gs32": {},
              },
            },
          },
          models: {
            mode: "merge",
            providers: {
              minimax: {
                baseUrl: "https://api.minimax.io/anthropic",
                apiKey: "sk-test",
                api: "anthropic-messages",
                models: [{ id: "MiniMax-M2.1", name: "MiniMax M2.1" }],
              },
              lmstudio: {
                baseUrl: "http://127.0.0.1:1234/v1",
                apiKey: "lmstudio",
                api: "openai-responses",
                models: [{ id: "minimax-m2.1-gs32", name: "MiniMax M2.1 GS32" }],
              },
            },
          },
          session: { store: storePath },
        },
      );

      assertModelSelection(storePath);
      expect(runEmbeddedPiAgent).not.toHaveBeenCalled();
    });
  });
  it("picks the best fuzzy match within a provider", async () => {
    await withTempHome(async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockReset();
      const storePath = path.join(home, "sessions.json");

      await getReplyFromConfig(
        { Body: "/model minimax/m2.1", From: "+1222", To: "+1222", CommandAuthorized: true },
        {},
        {
          agents: {
            defaults: {
              model: { primary: "minimax/MiniMax-M2.1" },
              workspace: path.join(home, "marketbot"),
              models: {
                "minimax/MiniMax-M2.1": {},
                "minimax/MiniMax-M2.1-lightning": {},
              },
            },
          },
          models: {
            mode: "merge",
            providers: {
              minimax: {
                baseUrl: "https://api.minimax.io/anthropic",
                apiKey: "sk-test",
                api: "anthropic-messages",
                models: [
                  { id: "MiniMax-M2.1", name: "MiniMax M2.1" },
                  {
                    id: "MiniMax-M2.1-lightning",
                    name: "MiniMax M2.1 Lightning",
                  },
                ],
              },
            },
          },
          session: { store: storePath },
        },
      );

      assertModelSelection(storePath);
      expect(runEmbeddedPiAgent).not.toHaveBeenCalled();
    });
  });
});
