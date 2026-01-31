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

import { describe, expect, it } from "vitest";

import type { SubagentRunRecord } from "../../agents/subagent-registry.js";
import {
  formatDurationShort,
  formatRunLabel,
  formatRunStatus,
  resolveSubagentLabel,
  sortSubagentRuns,
} from "./subagents-utils.js";

const baseRun: SubagentRunRecord = {
  runId: "run-1",
  childSessionKey: "agent:main:subagent:abc",
  requesterSessionKey: "agent:main:main",
  requesterDisplayKey: "main",
  task: "do thing",
  cleanup: "keep",
  createdAt: 1000,
  startedAt: 1000,
};

describe("subagents utils", () => {
  it("resolves labels from label, task, or fallback", () => {
    expect(resolveSubagentLabel({ ...baseRun, label: "Label" })).toBe("Label");
    expect(resolveSubagentLabel({ ...baseRun, label: " ", task: "Task" })).toBe("Task");
    expect(resolveSubagentLabel({ ...baseRun, label: " ", task: " " }, "fallback")).toBe(
      "fallback",
    );
  });

  it("formats run labels with truncation", () => {
    const long = "x".repeat(100);
    const run = { ...baseRun, label: long };
    const formatted = formatRunLabel(run, { maxLength: 10 });
    expect(formatted.startsWith("x".repeat(10))).toBe(true);
    expect(formatted.endsWith("…")).toBe(true);
  });

  it("sorts subagent runs by newest start/created time", () => {
    const runs: SubagentRunRecord[] = [
      { ...baseRun, runId: "run-1", createdAt: 1000, startedAt: 1000 },
      { ...baseRun, runId: "run-2", createdAt: 1200, startedAt: 1200 },
      { ...baseRun, runId: "run-3", createdAt: 900 },
    ];
    const sorted = sortSubagentRuns(runs);
    expect(sorted.map((run) => run.runId)).toEqual(["run-2", "run-1", "run-3"]);
  });

  it("formats run status from outcome and timestamps", () => {
    expect(formatRunStatus({ ...baseRun })).toBe("running");
    expect(formatRunStatus({ ...baseRun, endedAt: 2000, outcome: { status: "ok" } })).toBe("done");
    expect(formatRunStatus({ ...baseRun, endedAt: 2000, outcome: { status: "timeout" } })).toBe(
      "timeout",
    );
  });

  it("formats duration short for seconds and minutes", () => {
    expect(formatDurationShort(45_000)).toBe("45s");
    expect(formatDurationShort(65_000)).toBe("1m5s");
  });
});
