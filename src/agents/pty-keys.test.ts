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

import { expect, test } from "vitest";

import {
  BRACKETED_PASTE_END,
  BRACKETED_PASTE_START,
  encodeKeySequence,
  encodePaste,
} from "./pty-keys.js";

test("encodeKeySequence maps common keys and modifiers", () => {
  const enter = encodeKeySequence({ keys: ["Enter"] });
  expect(enter.data).toBe("\r");

  const ctrlC = encodeKeySequence({ keys: ["C-c"] });
  expect(ctrlC.data).toBe("\x03");

  const altX = encodeKeySequence({ keys: ["M-x"] });
  expect(altX.data).toBe("\x1bx");

  const shiftTab = encodeKeySequence({ keys: ["S-Tab"] });
  expect(shiftTab.data).toBe("\x1b[Z");

  const kpEnter = encodeKeySequence({ keys: ["KPEnter"] });
  expect(kpEnter.data).toBe("\x1bOM");
});

test("encodeKeySequence supports hex + literal with warnings", () => {
  const result = encodeKeySequence({
    literal: "hi",
    hex: ["0d", "0x0a", "zz"],
    keys: ["Enter"],
  });
  expect(result.data).toBe("hi\r\n\r");
  expect(result.warnings.length).toBe(1);
});

test("encodePaste wraps bracketed sequences by default", () => {
  const payload = encodePaste("line1\nline2\n");
  expect(payload.startsWith(BRACKETED_PASTE_START)).toBe(true);
  expect(payload.endsWith(BRACKETED_PASTE_END)).toBe(true);
});
