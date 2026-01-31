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

import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLogger, setLoggerOverride } from "../../logging.js";
import { logsHandlers } from "./logs.js";

const noop = () => false;

describe("logs.tail", () => {
  afterEach(() => {
    resetLogger();
    setLoggerOverride(null);
  });

  it("falls back to latest rolling log file when today is missing", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-logs-"));
    const older = path.join(tempDir, "marketbot-2026-01-20.log");
    const newer = path.join(tempDir, "marketbot-2026-01-21.log");

    await fs.writeFile(older, '{"msg":"old"}\n');
    await fs.writeFile(newer, '{"msg":"new"}\n');
    await fs.utimes(older, new Date(0), new Date(0));
    await fs.utimes(newer, new Date(), new Date());

    setLoggerOverride({ file: path.join(tempDir, "marketbot-2026-01-22.log") });

    const respond = vi.fn();
    await logsHandlers["logs.tail"]({
      params: {},
      respond,
      context: {} as unknown as Parameters<(typeof logsHandlers)["logs.tail"]>[0]["context"],
      client: null,
      req: { id: "req-1", type: "req", method: "logs.tail" },
      isWebchatConnect: noop,
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        file: newer,
        lines: ['{"msg":"new"}'],
      }),
      undefined,
    );

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
