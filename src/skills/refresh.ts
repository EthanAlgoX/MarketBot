import fs from "node:fs";
import path from "node:path";

import type { MarketBotConfig } from "../config/types.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agentScope.js";
import { resolveSkillDirs } from "./registry.js";

type SkillsChangeEvent = {
  workspaceDir?: string;
  reason: "watch" | "manual";
  changedPath?: string;
};

type SkillsWatchState = {
  watchers: fs.FSWatcher[];
  pathsKey: string;
  debounceMs: number;
  timer?: ReturnType<typeof setTimeout>;
  pendingPath?: string;
};

const listeners = new Set<(event: SkillsChangeEvent) => void>();
const workspaceVersions = new Map<string, number>();
let globalVersion = 0;
const watchers = new Map<string, SkillsWatchState>();

export const DEFAULT_SKILLS_WATCH_IGNORED: RegExp[] = [
  /(^|[\\/])\.git([\\/]|$)/,
  /(^|[\\/])node_modules([\\/]|$)/,
  /(^|[\\/])dist([\\/]|$)/,
];

function bumpVersion(current: number): number {
  const now = Date.now();
  return now <= current ? current + 1 : now;
}

function emit(event: SkillsChangeEvent) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

export function registerSkillsChangeListener(listener: (event: SkillsChangeEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function bumpSkillsSnapshotVersion(params?: {
  workspaceDir?: string;
  reason?: SkillsChangeEvent["reason"];
  changedPath?: string;
}): number {
  const reason = params?.reason ?? "manual";
  const changedPath = params?.changedPath;
  if (params?.workspaceDir) {
    const current = workspaceVersions.get(params.workspaceDir) ?? 0;
    const next = bumpVersion(current);
    workspaceVersions.set(params.workspaceDir, next);
    emit({ workspaceDir: params.workspaceDir, reason, changedPath });
    return next;
  }
  globalVersion = bumpVersion(globalVersion);
  emit({ reason, changedPath });
  return globalVersion;
}

export function getSkillsSnapshotVersion(workspaceDir?: string): number {
  if (!workspaceDir) return globalVersion;
  const local = workspaceVersions.get(workspaceDir) ?? 0;
  return Math.max(globalVersion, local);
}

export function ensureSkillsWatcher(params: {
  config: MarketBotConfig;
  agentId?: string;
  cwd?: string;
}): void {
  const config = params.config;
  const agentId = params.agentId ?? resolveDefaultAgentId(config);
  const cwd = params.cwd ?? process.cwd();
  const workspaceDir = resolveAgentWorkspaceDir(config, agentId, cwd);

  const watchEnabled = config.skills?.watch !== false;
  const debounceMsRaw = config.skills?.watchDebounceMs;
  const debounceMs =
    typeof debounceMsRaw === "number" && Number.isFinite(debounceMsRaw)
      ? Math.max(0, debounceMsRaw)
      : 250;

  const existing = watchers.get(workspaceDir);
  if (!watchEnabled) {
    if (existing) {
      watchers.delete(workspaceDir);
      if (existing.timer) clearTimeout(existing.timer);
      for (const watcher of existing.watchers) watcher.close();
    }
    return;
  }

  const watchPaths = resolveWatchPaths(config, agentId, cwd);
  const pathsKey = watchPaths.join("|");
  if (existing && existing.pathsKey === pathsKey && existing.debounceMs === debounceMs) return;
  if (existing) {
    watchers.delete(workspaceDir);
    if (existing.timer) clearTimeout(existing.timer);
    for (const watcher of existing.watchers) watcher.close();
  }

  const state: SkillsWatchState = { watchers: [], pathsKey, debounceMs };

  const schedule = (changedPath?: string) => {
    state.pendingPath = changedPath ?? state.pendingPath;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      const pendingPath = state.pendingPath;
      state.pendingPath = undefined;
      state.timer = undefined;
      bumpSkillsSnapshotVersion({
        workspaceDir,
        reason: "watch",
        changedPath: pendingPath,
      });
      ensureSkillsWatcher({ config, agentId, cwd });
    }, debounceMs);
  };

  for (const dir of watchPaths) {
    try {
      const watcher = fs.watch(dir, { persistent: true }, (_event, filename) => {
        const name = filename ? String(filename) : undefined;
        const fullPath = name ? path.join(dir, name) : dir;
        if (shouldIgnore(fullPath)) return;
        schedule(fullPath);
      });
      watcher.on("error", () => { });
      state.watchers.push(watcher);
    } catch {
      // ignore missing paths
    }
  }

  watchers.set(workspaceDir, state);
}

function resolveWatchPaths(config: MarketBotConfig, agentId: string, cwd: string): string[] {
  const roots = resolveSkillDirs(config, agentId, cwd);
  const paths = new Set<string>();

  for (const root of roots) {
    if (!exists(root)) continue;
    paths.add(root);
    for (const subdir of listSubdirs(root)) {
      paths.add(subdir);
    }
  }

  return Array.from(paths);
}

function listSubdirs(root: string): string[] {
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name));
  } catch {
    return [];
  }
}

function exists(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function shouldIgnore(candidate: string): boolean {
  return DEFAULT_SKILLS_WATCH_IGNORED.some((pattern) => pattern.test(candidate));
}
