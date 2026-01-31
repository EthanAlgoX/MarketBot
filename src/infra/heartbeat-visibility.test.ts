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
import type { MarketBotConfig } from "../config/config.js";
import { resolveHeartbeatVisibility } from "./heartbeat-visibility.js";

describe("resolveHeartbeatVisibility", () => {
  it("returns default values when no config is provided", () => {
    const cfg = {} as MarketBotConfig;
    const result = resolveHeartbeatVisibility({ cfg, channel: "telegram" });

    expect(result).toEqual({
      showOk: false,
      showAlerts: true,
      useIndicator: true,
    });
  });

  it("uses channel defaults when provided", () => {
    const cfg = {
      channels: {
        defaults: {
          heartbeat: {
            showOk: true,
            showAlerts: false,
            useIndicator: false,
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({ cfg, channel: "telegram" });

    expect(result).toEqual({
      showOk: true,
      showAlerts: false,
      useIndicator: false,
    });
  });

  it("per-channel config overrides channel defaults", () => {
    const cfg = {
      channels: {
        defaults: {
          heartbeat: {
            showOk: false,
            showAlerts: true,
            useIndicator: true,
          },
        },
        telegram: {
          heartbeat: {
            showOk: true,
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({ cfg, channel: "telegram" });

    expect(result).toEqual({
      showOk: true,
      showAlerts: true,
      useIndicator: true,
    });
  });

  it("per-account config overrides per-channel config", () => {
    const cfg = {
      channels: {
        defaults: {
          heartbeat: {
            showOk: false,
            showAlerts: true,
            useIndicator: true,
          },
        },
        telegram: {
          heartbeat: {
            showOk: false,
            showAlerts: false,
          },
          accounts: {
            primary: {
              heartbeat: {
                showOk: true,
                showAlerts: true,
              },
            },
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({
      cfg,
      channel: "telegram",
      accountId: "primary",
    });

    expect(result).toEqual({
      showOk: true,
      showAlerts: true,
      useIndicator: true,
    });
  });

  it("falls through to defaults when account has no heartbeat config", () => {
    const cfg = {
      channels: {
        defaults: {
          heartbeat: {
            showOk: false,
          },
        },
        telegram: {
          heartbeat: {
            showAlerts: false,
          },
          accounts: {
            primary: {},
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({
      cfg,
      channel: "telegram",
      accountId: "primary",
    });

    expect(result).toEqual({
      showOk: false,
      showAlerts: false,
      useIndicator: true,
    });
  });

  it("handles missing accountId gracefully", () => {
    const cfg = {
      channels: {
        telegram: {
          heartbeat: {
            showOk: true,
          },
          accounts: {
            primary: {
              heartbeat: {
                showOk: false,
              },
            },
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({ cfg, channel: "telegram" });

    expect(result.showOk).toBe(true);
  });

  it("handles non-existent account gracefully", () => {
    const cfg = {
      channels: {
        telegram: {
          heartbeat: {
            showOk: true,
          },
          accounts: {
            primary: {
              heartbeat: {
                showOk: false,
              },
            },
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({
      cfg,
      channel: "telegram",
      accountId: "nonexistent",
    });

    expect(result.showOk).toBe(true);
  });

  it("works with whatsapp channel", () => {
    const cfg = {
      channels: {
        whatsapp: {
          heartbeat: {
            showOk: true,
            showAlerts: false,
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({ cfg, channel: "whatsapp" });

    expect(result).toEqual({
      showOk: true,
      showAlerts: false,
      useIndicator: true,
    });
  });

  it("works with discord channel", () => {
    const cfg = {
      channels: {
        discord: {
          heartbeat: {
            useIndicator: false,
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({ cfg, channel: "discord" });

    expect(result).toEqual({
      showOk: false,
      showAlerts: true,
      useIndicator: false,
    });
  });

  it("works with slack channel", () => {
    const cfg = {
      channels: {
        slack: {
          heartbeat: {
            showOk: true,
            showAlerts: true,
            useIndicator: true,
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({ cfg, channel: "slack" });

    expect(result).toEqual({
      showOk: true,
      showAlerts: true,
      useIndicator: true,
    });
  });

  it("webchat uses channel defaults only (no per-channel config)", () => {
    const cfg = {
      channels: {
        defaults: {
          heartbeat: {
            showOk: true,
            showAlerts: false,
            useIndicator: false,
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({ cfg, channel: "webchat" });

    expect(result).toEqual({
      showOk: true,
      showAlerts: false,
      useIndicator: false,
    });
  });

  it("webchat returns defaults when no channel defaults configured", () => {
    const cfg = {} as MarketBotConfig;

    const result = resolveHeartbeatVisibility({ cfg, channel: "webchat" });

    expect(result).toEqual({
      showOk: false,
      showAlerts: true,
      useIndicator: true,
    });
  });

  it("webchat ignores accountId (only uses defaults)", () => {
    const cfg = {
      channels: {
        defaults: {
          heartbeat: {
            showOk: true,
          },
        },
      },
    } as MarketBotConfig;

    const result = resolveHeartbeatVisibility({
      cfg,
      channel: "webchat",
      accountId: "some-account",
    });

    expect(result.showOk).toBe(true);
  });
});
