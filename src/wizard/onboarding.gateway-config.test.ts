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
import type { WizardPrompter } from "./prompts.js";

const mocks = vi.hoisted(() => ({
  randomToken: vi.fn(),
}));

vi.mock("../commands/onboard-helpers.js", async (importActual) => {
  const actual = await importActual<typeof import("../commands/onboard-helpers.js")>();
  return {
    ...actual,
    randomToken: mocks.randomToken,
  };
});

vi.mock("../infra/tailscale.js", () => ({
  findTailscaleBinary: vi.fn(async () => undefined),
}));

import { configureGatewayForOnboarding } from "./onboarding.gateway-config.js";

describe("configureGatewayForOnboarding", () => {
  it("generates a token when the prompt returns undefined", async () => {
    mocks.randomToken.mockReturnValue("generated-token");

    const selectQueue = ["loopback", "token", "off"];
    const textQueue = ["18789", undefined];
    const prompter: WizardPrompter = {
      intro: vi.fn(async () => {}),
      outro: vi.fn(async () => {}),
      note: vi.fn(async () => {}),
      select: vi.fn(async () => selectQueue.shift() as string),
      multiselect: vi.fn(async () => []),
      text: vi.fn(async () => textQueue.shift() as string),
      confirm: vi.fn(async () => false),
      progress: vi.fn(() => ({ update: vi.fn(), stop: vi.fn() })),
    };

    const runtime: RuntimeEnv = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    const result = await configureGatewayForOnboarding({
      flow: "advanced",
      baseConfig: {},
      nextConfig: {},
      localPort: 18789,
      quickstartGateway: {
        hasExisting: false,
        port: 18789,
        bind: "loopback",
        authMode: "token",
        tailscaleMode: "off",
        token: undefined,
        password: undefined,
        customBindHost: undefined,
        tailscaleResetOnExit: false,
      },
      prompter,
      runtime,
    });

    expect(result.settings.gatewayToken).toBe("generated-token");
  });
});
