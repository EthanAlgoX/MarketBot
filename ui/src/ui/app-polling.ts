import { loadLogs } from "./controllers/logs";
import type { MarketBotApp } from "./app";

type PollingHost = {
  logsPollInterval: number | null;
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
