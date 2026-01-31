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

import { describe, expect, it } from "vitest";

import { isSignalGroupAllowed } from "./identity.js";

describe("signal groupPolicy gating", () => {
  it("allows when policy is open", () => {
    expect(
      isSignalGroupAllowed({
        groupPolicy: "open",
        allowFrom: [],
        sender: { kind: "phone", raw: "+15550001111", e164: "+15550001111" },
      }),
    ).toBe(true);
  });

  it("blocks when policy is disabled", () => {
    expect(
      isSignalGroupAllowed({
        groupPolicy: "disabled",
        allowFrom: ["+15550001111"],
        sender: { kind: "phone", raw: "+15550001111", e164: "+15550001111" },
      }),
    ).toBe(false);
  });

  it("blocks allowlist when empty", () => {
    expect(
      isSignalGroupAllowed({
        groupPolicy: "allowlist",
        allowFrom: [],
        sender: { kind: "phone", raw: "+15550001111", e164: "+15550001111" },
      }),
    ).toBe(false);
  });

  it("allows allowlist when sender matches", () => {
    expect(
      isSignalGroupAllowed({
        groupPolicy: "allowlist",
        allowFrom: ["+15550001111"],
        sender: { kind: "phone", raw: "+15550001111", e164: "+15550001111" },
      }),
    ).toBe(true);
  });

  it("allows allowlist wildcard", () => {
    expect(
      isSignalGroupAllowed({
        groupPolicy: "allowlist",
        allowFrom: ["*"],
        sender: { kind: "phone", raw: "+15550002222", e164: "+15550002222" },
      }),
    ).toBe(true);
  });

  it("allows allowlist when uuid sender matches", () => {
    expect(
      isSignalGroupAllowed({
        groupPolicy: "allowlist",
        allowFrom: ["uuid:123e4567-e89b-12d3-a456-426614174000"],
        sender: {
          kind: "uuid",
          raw: "123e4567-e89b-12d3-a456-426614174000",
        },
      }),
    ).toBe(true);
  });
});
