import type { GatewayBrowserClient } from "../gateway";
import type { TraceRunEvent, TraceRunMeta } from "../types";

export type RunsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;

  runsLoading: boolean;
  runsError: string | null;
  runs: TraceRunMeta[];

  runLoading: boolean;
  runError: string | null;
  runId: string | null;
  runEvents: TraceRunEvent[];
  runTruncated: boolean;
};

export async function loadRuns(state: RunsState, opts?: { quiet?: boolean }) {
  if (!state.client || !state.connected) return;
  if (state.runsLoading && !opts?.quiet) return;
  if (!opts?.quiet) state.runsLoading = true;
  state.runsError = null;
  try {
    const res = await state.client.request("trace.runs.list", { limit: 80 });
    const payload = res as { runs?: unknown };
    const runs = Array.isArray(payload.runs)
      ? (payload.runs.filter((r) => r && typeof r === "object") as TraceRunMeta[])
      : [];
    state.runs = runs;
  } catch (err) {
    state.runsError = String(err);
  } finally {
    if (!opts?.quiet) state.runsLoading = false;
  }
}

export async function loadRun(state: RunsState, runId: string, opts?: { quiet?: boolean }) {
  if (!state.client || !state.connected) return;
  const trimmed = runId.trim();
  if (!trimmed) return;
  if (state.runLoading && !opts?.quiet) return;
  if (!opts?.quiet) state.runLoading = true;
  state.runError = null;
  state.runId = trimmed;
  try {
    const res = await state.client.request("trace.run.get", { runId: trimmed, limit: 15000 });
    const payload = res as { runId?: unknown; events?: unknown; truncated?: unknown };
    const events = Array.isArray(payload.events)
      ? (payload.events.filter((e) => e && typeof e === "object") as TraceRunEvent[])
      : [];
    state.runEvents = events;
    state.runTruncated = Boolean(payload.truncated);
  } catch (err) {
    state.runError = String(err);
  } finally {
    if (!opts?.quiet) state.runLoading = false;
  }
}

