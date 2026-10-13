// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  path.resolve(import.meta.dirname, "../../../.github/workflows/release-desktop.yml"),
  "utf8",
);

describe("desktop package validation workflow", () => {
  it("runs only by manual dispatch without release credentials or write permissions", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s*(push|pull_request|release|schedule):/m);
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toMatch(/:\s*write\b/);
    expect(workflow).not.toContain("secrets.");
  });

  it("pins third-party actions and validates an unpacked package without publishing", () => {
    const references = [...workflow.matchAll(/uses:\s+([^\s#]+)/g)].map((match) => match[1]);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) expect(reference).toMatch(/@[0-9a-f]{40}$/);
    expect(workflow).toContain("--linux --dir --publish never");
    expect(workflow).not.toMatch(/gh release|--publish always|--publish onTag|upload-release/);
  });
});
