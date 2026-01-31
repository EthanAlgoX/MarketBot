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

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolvePluginTools } from "./tools.js";

type TempPlugin = { dir: string; file: string; id: string };

const tempDirs: string[] = [];
const EMPTY_PLUGIN_SCHEMA = { type: "object", additionalProperties: false, properties: {} };

function makeTempDir() {
  const dir = path.join(os.tmpdir(), `marketbot-plugin-tools-${randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function writePlugin(params: { id: string; body: string }): TempPlugin {
  const dir = makeTempDir();
  const file = path.join(dir, `${params.id}.js`);
  fs.writeFileSync(file, params.body, "utf-8");
  fs.writeFileSync(
    path.join(dir, "marketbot.plugin.json"),
    JSON.stringify(
      {
        id: params.id,
        configSchema: EMPTY_PLUGIN_SCHEMA,
      },
      null,
      2,
    ),
    "utf-8",
  );
  return { dir, file, id: params.id };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
});

describe("resolvePluginTools optional tools", () => {
  const pluginBody = `
export default { register(api) {
  api.registerTool(
    {
      name: "optional_tool",
      description: "optional tool",
      parameters: { type: "object", properties: {} },
      async execute() {
        return { content: [{ type: "text", text: "ok" }] };
      },
    },
    { optional: true },
  );
} }
`;

  it("skips optional tools without explicit allowlist", () => {
    const plugin = writePlugin({ id: "optional-demo", body: pluginBody });
    const tools = resolvePluginTools({
      context: {
        config: {
          plugins: {
            load: { paths: [plugin.file] },
            allow: [plugin.id],
          },
        },
        workspaceDir: plugin.dir,
      },
    });
    expect(tools).toHaveLength(0);
  });

  it("allows optional tools by name", () => {
    const plugin = writePlugin({ id: "optional-demo", body: pluginBody });
    const tools = resolvePluginTools({
      context: {
        config: {
          plugins: {
            load: { paths: [plugin.file] },
            allow: [plugin.id],
          },
        },
        workspaceDir: plugin.dir,
      },
      toolAllowlist: ["optional_tool"],
    });
    expect(tools.map((tool) => tool.name)).toContain("optional_tool");
  });

  it("allows optional tools via plugin groups", () => {
    const plugin = writePlugin({ id: "optional-demo", body: pluginBody });
    const toolsAll = resolvePluginTools({
      context: {
        config: {
          plugins: {
            load: { paths: [plugin.file] },
            allow: [plugin.id],
          },
        },
        workspaceDir: plugin.dir,
      },
      toolAllowlist: ["group:plugins"],
    });
    expect(toolsAll.map((tool) => tool.name)).toContain("optional_tool");

    const toolsPlugin = resolvePluginTools({
      context: {
        config: {
          plugins: {
            load: { paths: [plugin.file] },
            allow: [plugin.id],
          },
        },
        workspaceDir: plugin.dir,
      },
      toolAllowlist: ["optional-demo"],
    });
    expect(toolsPlugin.map((tool) => tool.name)).toContain("optional_tool");
  });

  it("rejects plugin id collisions with core tool names", () => {
    const plugin = writePlugin({ id: "message", body: pluginBody });
    const tools = resolvePluginTools({
      context: {
        config: {
          plugins: {
            load: { paths: [plugin.file] },
            allow: [plugin.id],
          },
        },
        workspaceDir: plugin.dir,
      },
      existingToolNames: new Set(["message"]),
      toolAllowlist: ["message"],
    });
    expect(tools).toHaveLength(0);
  });

  it("skips conflicting tool names but keeps other tools", () => {
    const plugin = writePlugin({
      id: "multi",
      body: `
export default { register(api) {
  api.registerTool({
    name: "message",
    description: "conflict",
    parameters: { type: "object", properties: {} },
    async execute() {
      return { content: [{ type: "text", text: "nope" }] };
    },
  });
  api.registerTool({
    name: "other_tool",
    description: "ok",
    parameters: { type: "object", properties: {} },
    async execute() {
      return { content: [{ type: "text", text: "ok" }] };
    },
  });
} }
`,
    });

    const tools = resolvePluginTools({
      context: {
        config: {
          plugins: {
            load: { paths: [plugin.file] },
            allow: [plugin.id],
          },
        },
        workspaceDir: plugin.dir,
      },
      existingToolNames: new Set(["message"]),
    });

    expect(tools.map((tool) => tool.name)).toEqual(["other_tool"]);
  });
});
