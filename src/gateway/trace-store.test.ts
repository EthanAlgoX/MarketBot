import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type { AgentEventPayload } from "../infra/agent-events.js";
import {
  __resetTraceMetaCacheForTest,
  getTraceRunEvents,
  listTraceRuns,
  recordTraceAgentEvent,
} from "./trace-store.js";

describe("gateway/trace-store", () => {
  it("records agent events and exposes meta + events for replay", async () => {
    __resetTraceMetaCacheForTest();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-trace-"));

    const prev = process.env.MARKETBOT_STATE_DIR;
    process.env.MARKETBOT_STATE_DIR = tmp;
    try {
      const base: Omit<AgentEventPayload, "stream" | "data"> = {
        runId: "run-1",
        seq: 1,
        ts: Date.now(),
        sessionKey: "main",
      };

      await recordTraceAgentEvent({
        runId: "run-1",
        evt: {
          ...base,
          stream: "lifecycle",
          data: { phase: "start", startedAt: base.ts },
        },
        clientRunId: "run-1",
        sessionKey: "main",
      });
      await recordTraceAgentEvent({
        runId: "run-1",
        evt: {
          ...base,
          seq: 2,
          stream: "tool",
          data: { phase: "start", name: "web_fetch", toolCallId: "t1", args: { url: "x" } },
        },
        clientRunId: "run-1",
        sessionKey: "main",
      });
      await recordTraceAgentEvent({
        runId: "run-1",
        evt: {
          ...base,
          seq: 3,
          stream: "tool",
          data: { phase: "result", name: "web_fetch", toolCallId: "t1", isError: false },
        },
        clientRunId: "run-1",
        sessionKey: "main",
      });
      await recordTraceAgentEvent({
        runId: "run-1",
        evt: {
          ...base,
          seq: 4,
          stream: "lifecycle",
          data: { phase: "end", endedAt: base.ts + 10 },
        },
        clientRunId: "run-1",
        sessionKey: "main",
      });

      // Wait for debounced meta flush.
      await new Promise((r) => setTimeout(r, 250));

      const runs = await listTraceRuns({ limit: 10 });
      const meta = runs.find((r) => r.runId === "run-1");
      expect(meta).toBeTruthy();
      expect(meta?.sessionKey).toBe("main");
      expect(meta?.toolCalls).toBe(1);
      expect(meta?.toolErrors).toBe(0);
      expect(meta?.status).toBe("ended");

      const res = await getTraceRunEvents({ runId: "run-1", limit: 100 });
      expect(res.runId).toBe("run-1");
      expect(res.truncated).toBe(false);
      expect(res.events.length).toBe(4);
      expect(res.events[1]?.stream).toBe("tool");
    } finally {
      process.env.MARKETBOT_STATE_DIR = prev;
    }
  });
});
