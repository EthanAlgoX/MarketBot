import type { MarketBotConfig } from "../config/types.js";
import { resolveAgentConfig } from "../agents/agentScope.js";

export type ToolProfileId = "minimal" | "analysis" | "full";

export type ToolPolicyConfig = {
  allow?: string[];
  alsoAllow?: string[];
  deny?: string[];
  profile?: ToolProfileId;
};

export const TOOL_PROFILES: Record<ToolProfileId, string[]> = {
  minimal: [],
  analysis: ["market_fetch", "indicators_compute", "market_summary", "report_render", "web_search"],
  full: [
    "echo",
    "http_get",
    "web_search",
    "market_fetch",
    "indicators_compute",
    "market_summary",
    "report_render",
    "signal_analyze",
    "portfolio_add",
    "portfolio_remove",
    "portfolio_status",
  ],
};

export function resolveToolPolicy(config: MarketBotConfig, agentId?: string): ToolPolicyConfig | undefined {
  const base = config.tools;
  if (!agentId) return base;
  const agentTools = resolveAgentConfig(config, agentId)?.tools;
  if (!agentTools) return base;
  return mergeToolPolicies(base, agentTools);
}

export function mergeToolPolicies(
  base: ToolPolicyConfig | undefined,
  override: ToolPolicyConfig | undefined,
): ToolPolicyConfig | undefined {
  if (!override && !base) return undefined;
  if (!override) return base;
  if (!base) return override;

  return {
    allow: override.allow !== undefined ? override.allow : base.allow,
    profile: override.profile ?? base.profile,
    alsoAllow: [...(base.alsoAllow ?? []), ...(override.alsoAllow ?? [])],
    deny: [...(base.deny ?? []), ...(override.deny ?? [])],
  };
}

export function resolveToolAllowlist(
  policy: ToolPolicyConfig | undefined,
  allTools: string[] = [],
): string[] {
  if (!policy) return uniqueNames(allTools, allTools);

  const base = policy.profile
    ? TOOL_PROFILES[policy.profile] ?? []
    : policy.allow !== undefined
      ? policy.allow
      : allTools;

  const merged = [...base, ...(policy.alsoAllow ?? [])];
  const allowlist = uniqueNames(merged, allTools);
  const deny = new Set((policy.deny ?? []).map(normalizeName));

  return allowlist.filter((name) => !deny.has(normalizeName(name)));
}

export function isToolAllowed(
  toolName: string,
  policy: ToolPolicyConfig | undefined,
  allTools: string[] = [],
): boolean {
  if (!policy) return true;
  const allowlist = resolveToolAllowlist(policy, allTools);
  if (allowlist.length === 0) return false;
  const target = normalizeName(toolName);
  return allowlist.some((name) => normalizeName(name) === target);
}

function uniqueNames(candidates: string[], allTools: string[]): string[] {
  const canonical = new Map<string, string>();
  for (const name of allTools) {
    const normalized = normalizeName(name);
    if (normalized) canonical.set(normalized, name);
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of candidates) {
    const normalized = normalizeName(raw);
    if (!normalized || seen.has(normalized)) continue;
    const resolved = canonical.get(normalized) ?? raw.trim();
    if (!resolved) continue;
    seen.add(normalized);
    result.push(resolved);
  }

  return result;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
