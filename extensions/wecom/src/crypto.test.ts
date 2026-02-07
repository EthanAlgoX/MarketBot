import { describe, expect, it } from "vitest";

import { wecomDecrypt, wecomEncrypt, wecomSignature } from "./crypto.js";

describe("wecom crypto", () => {
  it("roundtrips encrypt/decrypt", () => {
    const encodingAesKey = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"; // 43 chars
    const corpId = "ww1234567890abcdef";
    const plaintextXml = "<xml><ToUserName>to</ToUserName><Content>hello</Content></xml>";
    const encrypt = wecomEncrypt({ encodingAesKey, corpId, plaintextXml });
    const out = wecomDecrypt({ encodingAesKey, corpId, encrypt });
    expect(out.plaintextXml).toBe(plaintextXml);
  });

  it("computes sha1 signature", () => {
    const sig = wecomSignature({
      token: "token",
      timestamp: "1700000000",
      nonce: "nonce",
      encrypt: "ENCRYPT",
    });
    expect(sig).toMatch(/^[0-9a-f]{40}$/);
  });
});

