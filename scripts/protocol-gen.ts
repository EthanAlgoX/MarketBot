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

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProtocolSchemas } from "../src/gateway/protocol/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function writeJsonSchema() {
  const definitions: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(ProtocolSchemas)) {
    definitions[name] = schema;
  }

  const rootSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://marketbot.ai/protocol.schema.json",
    title: "MarketBot Gateway Protocol",
    description: "Handshake, request/response, and event frames for the Gateway WebSocket.",
    oneOf: [
      { $ref: "#/definitions/RequestFrame" },
      { $ref: "#/definitions/ResponseFrame" },
      { $ref: "#/definitions/EventFrame" },
    ],
    discriminator: {
      propertyName: "type",
      mapping: {
        req: "#/definitions/RequestFrame",
        res: "#/definitions/ResponseFrame",
        event: "#/definitions/EventFrame",
      },
    },
    definitions,
  };

  const distDir = path.join(repoRoot, "dist");
  await fs.mkdir(distDir, { recursive: true });
  const jsonSchemaPath = path.join(distDir, "protocol.schema.json");
  await fs.writeFile(jsonSchemaPath, JSON.stringify(rootSchema, null, 2));
  console.log(`wrote ${jsonSchemaPath}`);
  return { jsonSchemaPath, schemaString: JSON.stringify(rootSchema) };
}

async function main() {
  await writeJsonSchema();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
