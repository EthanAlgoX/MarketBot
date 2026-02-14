import { describe, expect, it } from "vitest";

import { isImageMediaFeishu } from "./media.js";

describe("feishu media detection", () => {
  it("treats image MIME type as image even without extension", () => {
    const result = isImageMediaFeishu({
      fileName: "download",
      contentType: "image/png; charset=utf-8",
      buffer: Buffer.from("not-a-real-png"),
    });
    expect(result).toBe(true);
  });

  it("treats image signature bytes as image even without extension and MIME", () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
    const result = isImageMediaFeishu({
      fileName: "asset",
      buffer: pngHeader,
    });
    expect(result).toBe(true);
  });

  it("keeps non-image payload as file", () => {
    const result = isImageMediaFeishu({
      fileName: "payload.bin",
      contentType: "application/octet-stream",
      buffer: Buffer.from([0x01, 0x02, 0x03, 0x04]),
    });
    expect(result).toBe(false);
  });
});
