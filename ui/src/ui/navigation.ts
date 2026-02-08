import type { IconName } from "./icons.js";
import type { UiLanguage } from "./storage";

export const TAB_GROUPS = [
  { label: "Chat", tabs: ["chat"] },
  {
    label: "Finance",
    tabs: ["desk", "stocks", "runs"],
  },
  {
    label: "Control",
    tabs: ["overview", "config", "channels", "sessions", "cron", "logs"],
  },
] as const;

export type Tab =
  | "desk"
  | "overview"
  | "config"
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
  config: "/config",
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
  if (normalized === "/") return "chat";
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
    case "config":
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
  return titleForTabWithLanguage(tab, "en");
}

export function titleForTabWithLanguage(tab: Tab, language: UiLanguage) {
  const titles: Record<UiLanguage, Record<Tab, string>> = {
    en: {
      desk: "Desk",
      overview: "Connection",
      config: "Config",
      stocks: "Stocks",
      channels: "Channels",
      sessions: "Sessions",
      cron: "Cron Jobs",
      runs: "Runs",
      chat: "Chat",
      logs: "Logs",
    },
    zh: {
      desk: "工作台",
      overview: "连接",
      config: "配置",
      stocks: "股票",
      channels: "渠道",
      sessions: "会话",
      cron: "定时任务",
      runs: "运行记录",
      chat: "对话",
      logs: "日志",
    },
  };
  const resolved = titles[language] ?? titles.en;
  return resolved[tab] ?? titles.en[tab] ?? "Control";
}

export function subtitleForTab(tab: Tab) {
  return subtitleForTabWithLanguage(tab, "en");
}

export function subtitleForTabWithLanguage(tab: Tab, language: UiLanguage) {
  const subtitles: Record<UiLanguage, Record<Tab, string>> = {
    en: {
      desk: "Daily stocks, research workflows, and delivery operations.",
      overview: "Gateway URL, token, and session defaults for this browser.",
      config: "AI models, tools, channels, and gateway configuration.",
      stocks: "Watchlists, decision dashboards, and daily research notes.",
      channels: "Manage channels and settings.",
      sessions: "Inspect active sessions and adjust per-session defaults.",
      cron: "Schedule wakeups and recurring agent runs.",
      runs: "Traceable and replayable run graphs (tools, policies, and lifecycle).",
      chat: "Direct gateway chat session for quick interventions.",
      logs: "Live tail of the gateway file logs.",
    },
    zh: {
      desk: "每日股票、研究流程与交付操作。",
      overview: "本浏览器的网关地址、令牌与默认会话。",
      config: "AI 模型、工具、渠道与网关配置。",
      stocks: "观察列表、决策面板与每日研究记录。",
      channels: "管理渠道与配置。",
      sessions: "查看会话并调整每个会话的默认设置。",
      cron: "安排唤醒与定时运行。",
      runs: "可追踪可回放的运行图谱。",
      chat: "用于快速干预的网关对话。",
      logs: "实时查看网关日志。",
    },
  };
  const resolved = subtitles[language] ?? subtitles.en;
  return resolved[tab] ?? subtitles.en[tab] ?? "";
}
