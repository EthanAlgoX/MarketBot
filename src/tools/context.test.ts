import { describe, expect, it } from "vitest";

import { buildToolContext } from "./context.js";

describe("buildToolContext", () => {
  it("parses JSON input", () => {
    const ctx = buildToolContext('{"asset":"BTC"}');
    expect(ctx.json).toEqual({ asset: "BTC" });
    expect(ctx.args).toEqual(["{\"asset\":\"BTC\"}"]);
  });

  it("handles empty input", () => {
    const ctx = buildToolContext(" ");
    expect(ctx.rawArgs).toBe("");
    expect(ctx.args).toEqual([]);
    expect(ctx.json).toBeUndefined();
  });
});
