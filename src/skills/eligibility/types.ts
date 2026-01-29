export interface SkillRequirements {
  bins: string[];
  anyBins: string[];
  env: string[];
  os: string[];
  config: string[];
}

export interface SkillMissing {
  bins: string[];
  anyBins: string[];
  env: string[];
  os: string[];
  config: string[];
}

export interface SkillEligibility {
  eligible: boolean;
  missing: SkillMissing;
  blockedByAllowlist: boolean;
}
