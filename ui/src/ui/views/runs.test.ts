import { render } from "lit";
import { describe, expect, it } from "vitest";

import { renderRuns, type RunsProps } from "./runs";

function createProps(overrides: Partial<RunsProps> = {}): RunsProps {
  return {
    language: "en",
    loading: false,
    error: null,
    runs: [],
    selectedRunId: null,
    runLoading: false,
    runError: null,
    runEvents: [],
    runTruncated: false,
    streamsFilter: {},
    replayIndex: 0,
    onRefreshRuns: () => undefined,
    onSelectRun: () => undefined,
    onRefreshRun: () => undefined,
    onToggleStream: () => undefined,
    onReplayIndex: () => undefined,
    ...overrides,
  };
}

describe("runs view", () => {
  it("renders summary stats and selected state", () => {
    const container = document.createElement("div");
    render(
      renderRuns(
        createProps({
          runs: [
            {
              runId: "run_a",
              sessionKey: "session:a",
              createdAtMs: Date.now() - 3000,
              startedAtMs: Date.now() - 2000,
              endedAtMs: Date.now() - 1000,
              lastEventAtMs: Date.now() - 500,
              status: "ended",
              streams: { tool: 3 },
              toolCalls: 3,
              toolErrors: 1,
            },
            {
              runId: "run_b",
              sessionKey: "session:b",
              createdAtMs: Date.now() - 3000,
              startedAtMs: Date.now() - 2000,
              endedAtMs: null,
              lastEventAtMs: Date.now() - 400,
              status: "running",
              streams: { policy: 2 },
              toolCalls: 2,
              toolErrors: 0,
            },
          ],
          selectedRunId: "run_b",
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Total Runs");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("Active");
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("Selected");
    expect(container.textContent).toContain("run_b");
  });

  it("shows select-run callout when no run is selected", () => {
    const container = document.createElement("div");
    render(
      renderRuns(
        createProps({
          runs: [
            {
              runId: "run_a",
              sessionKey: "session:a",
              createdAtMs: Date.now() - 3000,
              startedAtMs: Date.now() - 2000,
              endedAtMs: Date.now() - 1000,
              lastEventAtMs: Date.now() - 500,
              status: "ended",
              streams: { tool: 3 },
              toolCalls: 3,
              toolErrors: 1,
            },
          ],
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Select a run on the left.");
  });
});
