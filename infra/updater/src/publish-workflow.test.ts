// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Compose and workflow expressions are literal fixture data.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflowText = readFileSync(
  path.resolve(import.meta.dirname, "../../../.github/workflows/publish-server-image.yml"),
  "utf8",
);
const workflow = parse(workflowText) as {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<
    string,
    {
      permissions?: Record<string, string>;
      steps?: Array<{ uses?: string; with?: Record<string, unknown> }>;
    }
  >;
};

describe("server image validation workflow", () => {
  it("does not publish or run automatically on release tags", () => {
    expect(workflow.on.push).toBeUndefined();
    expect(workflow.on.workflow_dispatch).not.toBeUndefined();
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(Object.keys(workflow.jobs).sort()).toEqual(["installer-smoke", "validate"]);
    expect(workflowText).not.toContain("packages: write");
    expect(workflowText).not.toContain("contents: write");
    expect(workflowText).not.toContain("secrets.");
    expect(workflowText).not.toContain("push: true");
    expect(workflowText).toContain("push: false");
  });

  it("validates every local application image without a registry namespace", () => {
    expect(workflowText).toContain("images: marketbot/${{ matrix.name }}");
    expect(workflowText).not.toContain("ghcr.io");
    expect(workflowText).toContain("name: app");
    expect(workflowText).toContain("name: updater");
    expect(workflowText).toContain("name: computer");
  });

  it("keeps every action pinned to a commit and disables checkout credentials", () => {
    expect(workflowText).toContain("persist-credentials: false");
    for (const match of workflowText.matchAll(/uses:\s+([^\s#]+)/g)) {
      expect(match[1], match[1]).toMatch(/@[0-9a-f]{40}$/);
    }
  });
});
