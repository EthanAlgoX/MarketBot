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

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { sanitizeSessionMessagesImages } from "./pi-embedded-helpers.js";
import { DEFAULT_AGENTS_FILENAME } from "./workspace.js";

const _makeFile = (overrides: Partial<WorkspaceBootstrapFile>): WorkspaceBootstrapFile => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: "/tmp/AGENTS.md",
  content: "",
  missing: false,
  ...overrides,
});
describe("sanitizeSessionMessagesImages - thought_signature stripping", () => {
  it("strips msg_-prefixed thought_signature from assistant message content blocks", async () => {
    const input = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "hello", thought_signature: "msg_abc123" },
          {
            type: "thinking",
            thinking: "reasoning",
            thought_signature: "AQID",
          },
        ],
      },
    ] satisfies AgentMessage[];

    const out = await sanitizeSessionMessagesImages(input, "test");

    expect(out).toHaveLength(1);
    const content = (out[0] as { content?: unknown[] }).content;
    expect(content).toHaveLength(2);
    expect("thought_signature" in ((content?.[0] ?? {}) as object)).toBe(false);
    expect((content?.[1] as { thought_signature?: unknown })?.thought_signature).toBe("AQID");
  });
});
