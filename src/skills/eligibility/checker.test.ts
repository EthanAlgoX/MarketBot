import { describe, expect, it } from "vitest";

import { checkEligibility } from "./checker.js";

describe("checkEligibility", () => {
  it("respects allowlist", () => {
    const result = checkEligibility(
      { bins: [], anyBins: [], env: [], os: [], config: [] },
      { allowlist: ["allowed-skill"], skillKey: "allowed-skill" },
    );
    expect(result.blockedByAllowlist).toBe(false);
    expect(result.eligible).toBe(true);
  });

  it("blocks denylisted skill", () => {
    const result = checkEligibility(
      { bins: [], anyBins: [], env: [], os: [], config: [] },
      { denylist: ["blocked"], skillName: "blocked" },
    );
    expect(result.blockedByAllowlist).toBe(true);
    expect(result.eligible).toBe(false);
  });
});
