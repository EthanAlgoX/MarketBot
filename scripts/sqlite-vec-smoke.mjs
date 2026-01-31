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

import { DatabaseSync } from "node:sqlite";
import { load, getLoadablePath } from "sqlite-vec";

function vec(values) {
  return Buffer.from(new Float32Array(values).buffer);
}

const db = new DatabaseSync(":memory:", { allowExtension: true });

try {
  load(db);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("sqlite-vec load failed:");
  console.error(message);
  console.error("expected extension path:", getLoadablePath());
  process.exit(1);
}

db.exec(`
  CREATE VIRTUAL TABLE v USING vec0(
    id TEXT PRIMARY KEY,
    embedding FLOAT[4]
  );
`);

const insert = db.prepare("INSERT INTO v (id, embedding) VALUES (?, ?)");
insert.run("a", vec([1, 0, 0, 0]));
insert.run("b", vec([0, 1, 0, 0]));
insert.run("c", vec([0.2, 0.2, 0, 0]));

const query = vec([1, 0, 0, 0]);
const rows = db
  .prepare(
    "SELECT id, vec_distance_cosine(embedding, ?) AS dist FROM v ORDER BY dist ASC"
  )
  .all(query);

console.log("sqlite-vec ok");
console.log(rows);
