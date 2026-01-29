import type { MarketBotConfig } from "../config/types.js";

export interface SkillConfigEntry {
  enabled?: boolean;
  env?: Record<string, string>;
  config?: Record<string, string>;
  apiKey?: string;
}

export function resolveSkillConfig(config: MarketBotConfig | undefined, skillKey: string): SkillConfigEntry | undefined {
  const entries = config?.skills?.entries;
  if (!entries || typeof entries !== "object") return undefined;
  const entry = (entries as Record<string, SkillConfigEntry | undefined>)[skillKey];
  if (!entry || typeof entry !== "object") return undefined;
  return entry;
}

export function resolveAllowlist(config?: MarketBotConfig): string[] | undefined {
  const list = config?.skills?.allowlist;
  return normalizeList(list);
}

export function resolveDenylist(config?: MarketBotConfig): string[] | undefined {
  const list = config?.skills?.denylist;
  return normalizeList(list);
}

export function isSkillAllowed(params: {
  skillKey: string;
  name: string;
  allowlist?: string[];
  denylist?: string[];
}): boolean {
  const { skillKey, name, allowlist, denylist } = params;
  const normalizedKey = skillKey.toLowerCase();
  const normalizedName = name.toLowerCase();

  if (denylist && denylist.length > 0) {
    const blocked = denylist.some((entry) => {
      const value = entry.toLowerCase();
      return value === normalizedKey || value === normalizedName;
    });
    if (blocked) return false;
  }

  if (allowlist && allowlist.length > 0) {
    const allowed = allowlist.some((entry) => {
      const value = entry.toLowerCase();
      return value === normalizedKey || value === normalizedName || value === "*";
    });
    return allowed;
  }

  return true;
}

function normalizeList(input?: string[] | unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const normalized = input.map((entry) => String(entry).trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}
