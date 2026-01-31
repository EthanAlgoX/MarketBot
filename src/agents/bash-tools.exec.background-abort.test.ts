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

import { afterEach, expect, test } from "vitest";

import { createExecTool } from "./bash-tools.exec";
import {
  getFinishedSession,
  getSession,
  resetProcessRegistryForTests,
} from "./bash-process-registry";
import { killProcessTree } from "./shell-utils";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  resetProcessRegistryForTests();
});

test("background exec is not killed when tool signal aborts", async () => {
  const tool = createExecTool({ allowBackground: true, backgroundMs: 0 });
  const abortController = new AbortController();

  const result = await tool.execute(
    "toolcall",
    { command: 'node -e "setTimeout(() => {}, 5000)"', background: true },
    abortController.signal,
  );

  expect(result.details.status).toBe("running");
  const sessionId = (result.details as { sessionId: string }).sessionId;

  abortController.abort();

  await sleep(150);

  const running = getSession(sessionId);
  const finished = getFinishedSession(sessionId);

  try {
    expect(finished).toBeUndefined();
    expect(running?.exited).toBe(false);
  } finally {
    const pid = running?.pid;
    if (pid) {
      killProcessTree(pid);
    }
  }
});

test("background exec still times out after tool signal abort", async () => {
  const tool = createExecTool({ allowBackground: true, backgroundMs: 0 });
  const abortController = new AbortController();

  const result = await tool.execute(
    "toolcall",
    {
      command: 'node -e "setTimeout(() => {}, 5000)"',
      background: true,
      timeout: 0.2,
    },
    abortController.signal,
  );

  expect(result.details.status).toBe("running");
  const sessionId = (result.details as { sessionId: string }).sessionId;

  abortController.abort();

  let finished = getFinishedSession(sessionId);
  const deadline = Date.now() + (process.platform === "win32" ? 10_000 : 2_000);
  while (!finished && Date.now() < deadline) {
    await sleep(20);
    finished = getFinishedSession(sessionId);
  }

  const running = getSession(sessionId);

  try {
    expect(finished).toBeTruthy();
    expect(finished?.status).toBe("failed");
  } finally {
    const pid = running?.pid;
    if (pid) {
      killProcessTree(pid);
    }
  }
});

test("yielded background exec is not killed when tool signal aborts", async () => {
  const tool = createExecTool({ allowBackground: true, backgroundMs: 10 });
  const abortController = new AbortController();

  const result = await tool.execute(
    "toolcall",
    { command: 'node -e "setTimeout(() => {}, 5000)"', yieldMs: 5 },
    abortController.signal,
  );

  expect(result.details.status).toBe("running");
  const sessionId = (result.details as { sessionId: string }).sessionId;

  abortController.abort();

  await sleep(150);

  const running = getSession(sessionId);
  const finished = getFinishedSession(sessionId);

  try {
    expect(finished).toBeUndefined();
    expect(running?.exited).toBe(false);
  } finally {
    const pid = running?.pid;
    if (pid) {
      killProcessTree(pid);
    }
  }
});

test("yielded background exec still times out", async () => {
  const tool = createExecTool({ allowBackground: true, backgroundMs: 10 });

  const result = await tool.execute("toolcall", {
    command: 'node -e "setTimeout(() => {}, 5000)"',
    yieldMs: 5,
    timeout: 0.2,
  });

  expect(result.details.status).toBe("running");
  const sessionId = (result.details as { sessionId: string }).sessionId;

  let finished = getFinishedSession(sessionId);
  const deadline = Date.now() + (process.platform === "win32" ? 10_000 : 2_000);
  while (!finished && Date.now() < deadline) {
    await sleep(20);
    finished = getFinishedSession(sessionId);
  }

  const running = getSession(sessionId);

  try {
    expect(finished).toBeTruthy();
    expect(finished?.status).toBe("failed");
  } finally {
    const pid = running?.pid;
    if (pid) {
      killProcessTree(pid);
    }
  }
});
