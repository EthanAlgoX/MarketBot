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

import { vi } from "vitest";

import type { RuntimeEnv } from "../../../runtime.js";
import type { WizardPrompter } from "../../../wizard/prompts.js";

export const makeRuntime = (overrides: Partial<RuntimeEnv> = {}): RuntimeEnv => ({
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn((code: number) => {
    throw new Error(`exit:${code}`);
  }) as RuntimeEnv["exit"],
  ...overrides,
});

export const makePrompter = (overrides: Partial<WizardPrompter> = {}): WizardPrompter => ({
  intro: vi.fn(async () => {}),
  outro: vi.fn(async () => {}),
  note: vi.fn(async () => {}),
  select: vi.fn(async () => "npm") as WizardPrompter["select"],
  multiselect: vi.fn(async () => []) as WizardPrompter["multiselect"],
  text: vi.fn(async () => "") as WizardPrompter["text"],
  confirm: vi.fn(async () => false),
  progress: vi.fn(() => ({ update: vi.fn(), stop: vi.fn() })),
  ...overrides,
});
