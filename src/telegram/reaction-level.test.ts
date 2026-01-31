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

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { MarketBotConfig } from "../config/config.js";
import { resolveTelegramReactionLevel } from "./reaction-level.js";

describe("resolveTelegramReactionLevel", () => {
  const prevTelegramToken = process.env.TELEGRAM_BOT_TOKEN;

  beforeAll(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
  });

  afterAll(() => {
    if (prevTelegramToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = prevTelegramToken;
    }
  });

  it("defaults to minimal level when reactionLevel is not set", () => {
    const cfg: MarketBotConfig = {
      channels: { telegram: {} },
    };

    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("minimal");
    expect(result.ackEnabled).toBe(false);
    expect(result.agentReactionsEnabled).toBe(true);
    expect(result.agentReactionGuidance).toBe("minimal");
  });

  it("returns off level with no reactions enabled", () => {
    const cfg: MarketBotConfig = {
      channels: { telegram: { reactionLevel: "off" } },
    };

    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("off");
    expect(result.ackEnabled).toBe(false);
    expect(result.agentReactionsEnabled).toBe(false);
    expect(result.agentReactionGuidance).toBeUndefined();
  });

  it("returns ack level with only ackEnabled", () => {
    const cfg: MarketBotConfig = {
      channels: { telegram: { reactionLevel: "ack" } },
    };

    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("ack");
    expect(result.ackEnabled).toBe(true);
    expect(result.agentReactionsEnabled).toBe(false);
    expect(result.agentReactionGuidance).toBeUndefined();
  });

  it("returns minimal level with agent reactions enabled and minimal guidance", () => {
    const cfg: MarketBotConfig = {
      channels: { telegram: { reactionLevel: "minimal" } },
    };

    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("minimal");
    expect(result.ackEnabled).toBe(false);
    expect(result.agentReactionsEnabled).toBe(true);
    expect(result.agentReactionGuidance).toBe("minimal");
  });

  it("returns extensive level with agent reactions enabled and extensive guidance", () => {
    const cfg: MarketBotConfig = {
      channels: { telegram: { reactionLevel: "extensive" } },
    };

    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("extensive");
    expect(result.ackEnabled).toBe(false);
    expect(result.agentReactionsEnabled).toBe(true);
    expect(result.agentReactionGuidance).toBe("extensive");
  });

  it("resolves reaction level from a specific account", () => {
    const cfg: MarketBotConfig = {
      channels: {
        telegram: {
          reactionLevel: "ack",
          accounts: {
            work: { botToken: "tok-work", reactionLevel: "extensive" },
          },
        },
      },
    };

    const result = resolveTelegramReactionLevel({ cfg, accountId: "work" });
    expect(result.level).toBe("extensive");
    expect(result.ackEnabled).toBe(false);
    expect(result.agentReactionsEnabled).toBe(true);
    expect(result.agentReactionGuidance).toBe("extensive");
  });

  it("falls back to global level when account has no reactionLevel", () => {
    const cfg: MarketBotConfig = {
      channels: {
        telegram: {
          reactionLevel: "minimal",
          accounts: {
            work: { botToken: "tok-work" },
          },
        },
      },
    };

    const result = resolveTelegramReactionLevel({ cfg, accountId: "work" });
    expect(result.level).toBe("minimal");
    expect(result.agentReactionsEnabled).toBe(true);
    expect(result.agentReactionGuidance).toBe("minimal");
  });
});
