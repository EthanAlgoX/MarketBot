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
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const realOs = await vi.importActual<typeof import("node:os")>("node:os");
const HOME = path.join(realOs.tmpdir(), "marketbot-home-header-ext-test");

vi.mock("node:os", () => ({
  default: { homedir: () => HOME, tmpdir: () => realOs.tmpdir() },
  homedir: () => HOME,
  tmpdir: () => realOs.tmpdir(),
}));

vi.mock("./mime.js", async () => {
  const actual = await vi.importActual<typeof import("./mime.js")>("./mime.js");
  return {
    ...actual,
    detectMime: vi.fn(async () => "audio/opus"),
  };
});

const store = await import("./store.js");

describe("media store header extensions", () => {
  beforeAll(async () => {
    await fs.rm(HOME, { recursive: true, force: true });
  });

  afterAll(async () => {
    await fs.rm(HOME, { recursive: true, force: true });
  });

  it("prefers header mime extension when sniffed mime lacks mapping", async () => {
    const buf = Buffer.from("fake-audio");
    const saved = await store.saveMediaBuffer(buf, "audio/ogg; codecs=opus");
    expect(path.extname(saved.path)).toBe(".ogg");
  });
});
