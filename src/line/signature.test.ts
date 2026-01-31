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

import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateLineSignature } from "./signature.js";

const sign = (body: string, secret: string) =>
  crypto.createHmac("SHA256", secret).update(body).digest("base64");

describe("validateLineSignature", () => {
  it("accepts valid signatures", () => {
    const secret = "secret";
    const rawBody = JSON.stringify({ events: [{ type: "message" }] });

    expect(validateLineSignature(rawBody, sign(rawBody, secret), secret)).toBe(true);
  });

  it("rejects signatures computed with the wrong secret", () => {
    const rawBody = JSON.stringify({ events: [{ type: "message" }] });

    expect(validateLineSignature(rawBody, sign(rawBody, "wrong-secret"), "secret")).toBe(false);
  });

  it("rejects signatures with a different length", () => {
    const rawBody = JSON.stringify({ events: [{ type: "message" }] });

    expect(validateLineSignature(rawBody, "short", "secret")).toBe(false);
  });
});
