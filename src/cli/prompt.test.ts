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

import { isYes, setVerbose, setYes } from "../globals.js";

vi.mock("node:readline/promises", () => {
  const question = vi.fn<[], Promise<string>>();
  const close = vi.fn();
  const createInterface = vi.fn(() => ({ question, close }));
  return { default: { createInterface } };
});

type ReadlineMock = {
  default: {
    createInterface: () => {
      question: ReturnType<typeof vi.fn<[], Promise<string>>>;
      close: ReturnType<typeof vi.fn>;
    };
  };
};

const { promptYesNo } = await import("./prompt.js");
const readline = (await import("node:readline/promises")) as ReadlineMock;

describe("promptYesNo", () => {
  it("returns true when global --yes is set", async () => {
    setYes(true);
    setVerbose(false);
    const result = await promptYesNo("Continue?");
    expect(result).toBe(true);
    expect(isYes()).toBe(true);
  });

  it("asks the question and respects default", async () => {
    setYes(false);
    setVerbose(false);
    const { question: questionMock } = readline.default.createInterface();
    questionMock.mockResolvedValueOnce("");
    const resultDefaultYes = await promptYesNo("Continue?", true);
    expect(resultDefaultYes).toBe(true);

    questionMock.mockResolvedValueOnce("n");
    const resultNo = await promptYesNo("Continue?", true);
    expect(resultNo).toBe(false);

    questionMock.mockResolvedValueOnce("y");
    const resultYes = await promptYesNo("Continue?", false);
    expect(resultYes).toBe(true);
  });
});
