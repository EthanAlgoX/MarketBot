import { describe, expect, it } from "vitest";

import { clearQQBotTokenCache } from "./api.js";

describe("qqbot api", () => {
  it("clears token cache without throwing", () => {
    clearQQBotTokenCache();
    expect(true).toBe(true);
  });
});

