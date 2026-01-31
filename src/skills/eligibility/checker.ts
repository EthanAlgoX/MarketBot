import { spawnSync } from "node:child_process";
import os from "node:os";

import type { SkillEligibility, SkillMissing, SkillRequirements } from "./types.js";

export interface EligibilityOptions {
  allowlist?: string[];
  denylist?: string[];
  envOverrides?: Record<string, string | undefined>;
  configOverrides?: Record<string, string | undefined>;
  primaryEnv?: string;
  apiKey?: string;
  skillKey?: string;
  skillName?: string;
}

export function checkEligibility(
  requirements: SkillRequirements,
  options: EligibilityOptions = {},
): SkillEligibility {
  const missing: SkillMissing = {
    bins: [],
    anyBins: [],
    env: [],
    os: [],
    config: [],
  };

  const allowlist = new Set((options.allowlist ?? []).map((value) => value.toLowerCase()));
  const denylist = new Set((options.denylist ?? []).map((value) => value.toLowerCase()));
  const skillKey = options.skillKey?.toLowerCase();
  const skillName = options.skillName?.toLowerCase();
  const blockedByDenylist =
    (skillKey && denylist.has(skillKey)) || (skillName && denylist.has(skillName));
  const allowlistApplies = allowlist.size > 0;
  const allowlistAllows =
    allowlist.has("*") ||
    (skillKey && allowlist.has(skillKey)) ||
    (skillName && allowlist.has(skillName));
  const blockedByAllowlist = allowlistApplies && !allowlistAllows;

  if (requirements.bins.length > 0) {
    for (const bin of requirements.bins) {
      if (!hasBinary(bin)) missing.bins.push(bin);
    }
  }

  if (requirements.anyBins.length > 0) {
    const foundAny = requirements.anyBins.some((bin) => hasBinary(bin));
    if (!foundAny) missing.anyBins = [...requirements.anyBins];
  }

  if (requirements.env.length > 0) {
    for (const envVar of requirements.env) {
      const override = options.envOverrides?.[envVar];
      const apiKeyMatches = options.apiKey && options.primaryEnv === envVar;
      if (process.env[envVar] || override || apiKeyMatches) continue;
      missing.env.push(envVar);
    }
  }

  if (requirements.os.length > 0) {
    const platform = os.platform();
    if (!requirements.os.includes(platform)) {
      missing.os = [...requirements.os];
    }
  }

  if (requirements.config.length > 0) {
    for (const key of requirements.config) {
      const override = options.configOverrides?.[key];
      if (process.env[key] || override) continue;
      missing.config.push(key);
    }
  }

  const eligible =
    missing.bins.length === 0 &&
    missing.anyBins.length === 0 &&
    missing.env.length === 0 &&
    missing.os.length === 0 &&
    missing.config.length === 0 &&
    !blockedByAllowlist &&
    !blockedByDenylist;

  return {
    eligible,
    missing,
    blockedByAllowlist: Boolean(blockedByAllowlist || blockedByDenylist),
  };
}

function hasBinary(name: string): boolean {
  const result = spawnSync("/usr/bin/env", ["bash", "-lc", `command -v ${name}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}
