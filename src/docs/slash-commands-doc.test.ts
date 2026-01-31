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
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listChatCommands } from "../auto-reply/commands-registry.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";

beforeEach(() => {
  setActivePluginRegistry(createTestRegistry([]));
});

afterEach(() => {
  setActivePluginRegistry(createTestRegistry([]));
});

function extractDocumentedSlashCommands(markdown: string): Set<string> {
  const documented = new Set<string>();
  for (const match of markdown.matchAll(/`\/(?!<)([a-z0-9_-]+)/gi)) {
    documented.add(`/${match[1]}`);
  }
  return documented;
}

describe("slash commands docs", () => {
  it("documents all built-in chat command aliases", async () => {
    const docPath = path.join(process.cwd(), "docs", "tools", "slash-commands.md");
    const markdown = await fs.readFile(docPath, "utf8");
    const documented = extractDocumentedSlashCommands(markdown);

    for (const command of listChatCommands()) {
      for (const alias of command.textAliases) {
        expect(documented.has(alias)).toBe(true);
      }
    }
  });
});
