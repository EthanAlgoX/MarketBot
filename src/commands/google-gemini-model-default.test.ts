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
import {
  applyGoogleGeminiModelDefault,
  GOOGLE_GEMINI_DEFAULT_MODEL,
} from "./google-gemini-model-default.js";

describe("applyGoogleGeminiModelDefault", () => {
  it("sets gemini default when model is unset", () => {
    const cfg: MarketBotConfig = { agents: { defaults: {} } };
    const applied = applyGoogleGeminiModelDefault(cfg);
    expect(applied.changed).toBe(true);
    expect(applied.next.agents?.defaults?.model).toEqual({
      primary: GOOGLE_GEMINI_DEFAULT_MODEL,
    });
  });

  it("overrides existing model", () => {
    const cfg: MarketBotConfig = {
      agents: { defaults: { model: "anthropic/claude-opus-4-5" } },
    };
    const applied = applyGoogleGeminiModelDefault(cfg);
    expect(applied.changed).toBe(true);
    expect(applied.next.agents?.defaults?.model).toEqual({
      primary: GOOGLE_GEMINI_DEFAULT_MODEL,
    });
  });

  it("no-ops when already gemini default", () => {
    const cfg: MarketBotConfig = {
      agents: { defaults: { model: GOOGLE_GEMINI_DEFAULT_MODEL } },
    };
    const applied = applyGoogleGeminiModelDefault(cfg);
    expect(applied.changed).toBe(false);
    expect(applied.next).toEqual(cfg);
  });
});
