import type { IconName } from "./icons.js";

export const TAB_GROUPS = [
  { label: "Desk", tabs: ["desk"] },
  {
    label: "Finance",
    tabs: ["stocks"],
  },
  {
    label: "Ops",
    tabs: ["channels", "sessions", "cron", "runs", "logs"],
  },
  { label: "Research", tabs: ["chat"] },
  { label: "Settings", tabs: ["overview"] },
] as const;

export type Tab =
  | "desk"
  | "overview"
  | "stocks"
  | "channels"
  | "sessions"
  | "cron"
  | "runs"
  | "chat"
  | "logs";

const TAB_PATHS: Record<Tab, string> = {
  desk: "/desk",
  overview: "/overview",
  stocks: "/stocks",
  channels: "/channels",
  sessions: "/sessions",
  cron: "/cron",
  runs: "/runs",
  chat: "/chat",
  logs: "/logs",
};

const PATH_TO_TAB = new Map(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]),
);

export function normalizeBasePath(basePath: string): string {
  if (!basePath) return "";
  let base = basePath.trim();
  if (!base.startsWith("/")) base = `/${base}`;
  if (base === "/") return "";
  if (base.endsWith("/")) base = base.slice(0, -1);
  return base;
}

export function normalizePath(path: string): string {
  if (!path) return "/";
  let normalized = path.trim();
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function pathForTab(tab: Tab, basePath = ""): string {
  const base = normalizeBasePath(basePath);
  const path = TAB_PATHS[tab];
  return base ? `${base}${path}` : path;
}

export function tabFromPath(pathname: string, basePath = ""): Tab | null {
  const base = normalizeBasePath(basePath);
  let path = pathname || "/";
  if (base) {
    if (path === base) {
      path = "/";
    } else if (path.startsWith(`${base}/`)) {
      path = path.slice(base.length);
    }
  }
  let normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith("/index.html")) normalized = "/";
  if (normalized === "/") return "desk";
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function inferBasePathFromPathname(pathname: string): string {
  let normalized = normalizePath(pathname);
  if (normalized.endsWith("/index.html")) {
    normalized = normalizePath(normalized.slice(0, -"/index.html".length));
  }
  if (normalized === "/") return "";
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  for (let i = 0; i < segments.length; i++) {
    const candidate = `/${segments.slice(i).join("/")}`.toLowerCase();
    if (PATH_TO_TAB.has(candidate)) {
      const prefix = segments.slice(0, i);
      return prefix.length ? `/${prefix.join("/")}` : "";
    }
  }
  return `/${segments.join("/")}`;
}

export function iconForTab(tab: Tab): IconName {
  switch (tab) {
    case "desk":
      return "barChart";
    case "chat":
      return "messageSquare";
    case "overview":
      return "settings";
    case "stocks":
      return "barChart";
    case "channels":
      return "link";
    case "sessions":
      return "fileText";
    case "cron":
      return "loader";
    case "runs":
      return "activity";
    case "logs":
      return "scrollText";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab) {
  switch (tab) {
    case "desk":
      return "Desk";
    case "overview":
      return "Connection";
    case "stocks":
      return "Stocks";
    case "channels":
      return "Channels";
    case "sessions":
      return "Sessions";
    case "cron":
      return "Cron Jobs";
    case "runs":
      return "Runs";
    case "chat":
      return "Chat";
    case "logs":
      return "Logs";
    default:
      return "Control";
  }
}

export function subtitleForTab(tab: Tab) {
  switch (tab) {
    case "desk":
      return "Daily stocks, research workflows, and delivery operations.";
    case "overview":
      return "Gateway URL, token, and session defaults for this browser.";
    case "stocks":
      return "Watchlists, decision dashboards, and daily research notes.";
    case "channels":
      return "Manage channels and settings.";
    case "sessions":
      return "Inspect active sessions and adjust per-session defaults.";
    case "cron":
      return "Schedule wakeups and recurring agent runs.";
    case "runs":
      return "Traceable and replayable run graphs (tools, policies, and lifecycle).";
    case "chat":
      return "Direct gateway chat session for quick interventions.";
    case "logs":
      return "Live tail of the gateway file logs.";
    default:
      return "";
  }
}
