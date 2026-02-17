import { describe, expect, it } from "vitest";

import { FeishuConfigSchema } from "./config-schema.js";

describe("Feishu config schema", () => {
  it("accepts blockStreaming flag", () => {
    const parsed = FeishuConfigSchema.parse({
      appId: "app-id",
      appSecret: "app-secret",
      blockStreaming: true,
      streaming: true,
    });

    expect(parsed.blockStreaming).toBe(true);
    expect(parsed.streaming).toBe(true);
  });

  it("keeps blockStreaming undefined when omitted", () => {
    const parsed = FeishuConfigSchema.parse({
      appId: "app-id",
      appSecret: "app-secret",
    });

    expect(parsed.blockStreaming).toBeUndefined();
  });
});
