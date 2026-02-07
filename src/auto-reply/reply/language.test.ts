import { describe, expect, it } from "vitest";

import { buildReplyLanguageHint, detectReplyLanguage } from "./language.js";

describe("reply language detection", () => {
  it("detects Chinese when CJK dominates", () => {
    expect(detectReplyLanguage("请分析黄金行情")).toBe("zh");
    expect(buildReplyLanguageHint("请分析黄金行情")).toBe("[System: Reply in Chinese.]");
  });

  it("detects English when Latin dominates", () => {
    expect(detectReplyLanguage("Analyze gold prices over 3 months")).toBe("en");
    expect(buildReplyLanguageHint("Analyze gold prices over 3 months")).toBe(
      "[System: Reply in English.]",
    );
  });

  it("returns undefined when no language signals", () => {
    expect(detectReplyLanguage("12345 ???")).toBeUndefined();
    expect(buildReplyLanguageHint("12345 ???")).toBeUndefined();
  });

  it("prefers Chinese when mixed but CJK is not less than Latin", () => {
    expect(detectReplyLanguage("请分析 gold")).toBe("zh");
  });
});
