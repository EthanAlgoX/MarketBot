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

import { afterEach, expect, test, vi } from "vitest";

import { resetProcessRegistryForTests } from "./bash-process-registry";

afterEach(() => {
  resetProcessRegistryForTests();
  vi.resetModules();
  vi.clearAllMocks();
});

test("exec falls back when PTY spawn fails", async () => {
  vi.doMock("@lydell/node-pty", () => ({
    spawn: () => {
      const err = new Error("spawn EBADF");
      (err as NodeJS.ErrnoException).code = "EBADF";
      throw err;
    },
  }));

  const { createExecTool } = await import("./bash-tools.exec");
  const tool = createExecTool({ allowBackground: false });
  const result = await tool.execute("toolcall", {
    command: "printf ok",
    pty: true,
  });

  expect(result.details.status).toBe("completed");
  const text = result.content?.[0]?.text ?? "";
  expect(text).toContain("ok");
  expect(text).toContain("PTY spawn failed");
});
