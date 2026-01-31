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

import type { RuntimeEnv } from "../runtime.js";

const mocks = vi.hoisted(() => ({
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  resolveGatewayPort: vi.fn(),
  buildGatewayAuthConfig: vi.fn(),
  note: vi.fn(),
  randomToken: vi.fn(),
}));

vi.mock("../config/config.js", async (importActual) => {
  const actual = await importActual<typeof import("../config/config.js")>();
  return {
    ...actual,
    resolveGatewayPort: mocks.resolveGatewayPort,
  };
});

vi.mock("./configure.shared.js", () => ({
  text: mocks.text,
  select: mocks.select,
  confirm: mocks.confirm,
}));

vi.mock("../terminal/note.js", () => ({
  note: mocks.note,
}));

vi.mock("./configure.gateway-auth.js", () => ({
  buildGatewayAuthConfig: mocks.buildGatewayAuthConfig,
}));

vi.mock("../infra/tailscale.js", () => ({
  findTailscaleBinary: vi.fn(async () => undefined),
}));

vi.mock("./onboard-helpers.js", async (importActual) => {
  const actual = await importActual<typeof import("./onboard-helpers.js")>();
  return {
    ...actual,
    randomToken: mocks.randomToken,
  };
});

import { promptGatewayConfig } from "./configure.gateway.js";

describe("promptGatewayConfig", () => {
  it("generates a token when the prompt returns undefined", async () => {
    mocks.resolveGatewayPort.mockReturnValue(18789);
    const selectQueue = ["loopback", "token", "off"];
    mocks.select.mockImplementation(async () => selectQueue.shift());
    const textQueue = ["18789", undefined];
    mocks.text.mockImplementation(async () => textQueue.shift());
    mocks.randomToken.mockReturnValue("generated-token");
    mocks.buildGatewayAuthConfig.mockImplementation(({ mode, token, password }) => ({
      mode,
      token,
      password,
    }));

    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    const result = await promptGatewayConfig({}, runtime);
    expect(result.token).toBe("generated-token");
  });
});
