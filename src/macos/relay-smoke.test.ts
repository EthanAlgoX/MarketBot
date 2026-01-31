/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, expect, it, vi } from "vitest";
import { parseRelaySmokeTest, runRelaySmokeTest } from "./relay-smoke.js";

vi.mock("../web/qr-image.js", () => ({
  renderQrPngBase64: vi.fn(async () => "base64"),
}));

describe("parseRelaySmokeTest", () => {
  it("parses --smoke qr", () => {
    expect(parseRelaySmokeTest(["--smoke", "qr"], {})).toBe("qr");
  });

  it("parses --smoke-qr", () => {
    expect(parseRelaySmokeTest(["--smoke-qr"], {})).toBe("qr");
  });

  it("parses env var smoke mode only when no args", () => {
    expect(parseRelaySmokeTest([], { MARKETBOT_SMOKE_QR: "1" })).toBe("qr");
    expect(parseRelaySmokeTest(["send"], { MARKETBOT_SMOKE_QR: "1" })).toBe(null);
  });

  it("rejects unknown smoke values", () => {
    expect(() => parseRelaySmokeTest(["--smoke", "nope"], {})).toThrow("Unknown smoke test");
  });
});

describe("runRelaySmokeTest", () => {
  it("runs qr smoke test", async () => {
    await runRelaySmokeTest("qr");
    const mod = await import("../web/qr-image.js");
    expect(mod.renderQrPngBase64).toHaveBeenCalledWith("smoke-test");
  });
});
