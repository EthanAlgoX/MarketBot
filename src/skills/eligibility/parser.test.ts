import { describe, expect, it } from "vitest";

import { parseSkillMetadata } from "./parser.js";

describe("parseSkillMetadata", () => {
  it("parses metadata JSON with marketbot block", () => {
    const content = `---
name: market-scan
description: Fetch market data
metadata: {"marketbot":{"skillKey":"market-scan","primaryEnv":"API_KEY","requires":{"bins":["curl"],"env":["API_KEY"]},"commands":[{"name":"fetch","dispatch":{"kind":"tool","toolName":"market_fetch"}}]}}
---
`;
    const meta = parseSkillMetadata(content, "fallback");
    expect(meta.name).toBe("market-scan");
    expect(meta.skillKey).toBe("market-scan");
    expect(meta.primaryEnv).toBe("API_KEY");
    expect(meta.requirements.bins).toEqual(["curl"]);
    expect(meta.requirements.env).toEqual(["API_KEY"]);
    expect(meta.commands?.[0].name).toBe("fetch");
    expect(meta.commands?.[0].dispatch?.toolName).toBe("market_fetch");
  });

  it("parses requires.* inline keys", () => {
    const content = `---
name: charts
requires.bins: [curl]
requires.env: [API_KEY]
---
`;
    const meta = parseSkillMetadata(content, "charts");
    expect(meta.requirements.bins).toEqual(["curl"]);
    expect(meta.requirements.env).toEqual(["API_KEY"]);
  });
});
