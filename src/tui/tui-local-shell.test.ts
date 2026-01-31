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

import { createLocalShellRunner } from "./tui-local-shell.js";

const createSelector = () => {
  const selector = {
    onSelect: undefined as ((item: { value: string; label: string }) => void) | undefined,
    onCancel: undefined as (() => void) | undefined,
    render: () => ["selector"],
    invalidate: () => {},
  };
  return selector;
};

describe("createLocalShellRunner", () => {
  it("logs denial on subsequent ! attempts without re-prompting", async () => {
    const messages: string[] = [];
    const chatLog = {
      addSystem: (line: string) => {
        messages.push(line);
      },
    };
    const tui = { requestRender: vi.fn() };
    const openOverlay = vi.fn();
    const closeOverlay = vi.fn();
    let lastSelector: ReturnType<typeof createSelector> | null = null;
    const createSelectorSpy = vi.fn(() => {
      lastSelector = createSelector();
      return lastSelector;
    });
    const spawnCommand = vi.fn();

    const { runLocalShellLine } = createLocalShellRunner({
      chatLog,
      tui,
      openOverlay,
      closeOverlay,
      createSelector: createSelectorSpy,
      spawnCommand,
    });

    const firstRun = runLocalShellLine("!ls");
    expect(openOverlay).toHaveBeenCalledTimes(1);
    lastSelector?.onSelect?.({ value: "no", label: "No" });
    await firstRun;

    await runLocalShellLine("!pwd");

    expect(messages).toContain("local shell: not enabled");
    expect(messages).toContain("local shell: not enabled for this session");
    expect(createSelectorSpy).toHaveBeenCalledTimes(1);
    expect(spawnCommand).not.toHaveBeenCalled();
  });
});
