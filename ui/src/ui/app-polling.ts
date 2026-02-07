import { loadLogs } from "./controllers/logs";
import { loadRuns } from "./controllers/runs";
import type { MarketBotApp } from "./app";

type PollingHost = {
  logsPollInterval: number | null;
  runsPollInterval: number | null;
  tab: string;
};

export function startLogsPolling(host: PollingHost) {
  if (host.logsPollInterval != null) return;
  host.logsPollInterval = window.setInterval(() => {
    if (host.tab !== "logs") return;
    void loadLogs(host as unknown as MarketBotApp, { quiet: true });
  }, 2000);
}

export function stopLogsPolling(host: PollingHost) {
  if (host.logsPollInterval == null) return;
  clearInterval(host.logsPollInterval);
  host.logsPollInterval = null;
}

export function startRunsPolling(host: PollingHost) {
  if (host.runsPollInterval != null) return;
  host.runsPollInterval = window.setInterval(() => {
    if (host.tab !== "runs") return;
    void loadRuns(host as unknown as MarketBotApp, { quiet: true });
  }, 3000);
}

export function stopRunsPolling(host: PollingHost) {
  if (host.runsPollInterval == null) return;
  clearInterval(host.runsPollInterval);
  host.runsPollInterval = null;
}
