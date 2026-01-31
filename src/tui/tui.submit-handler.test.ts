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

import { createEditorSubmitHandler } from "./tui.js";

describe("createEditorSubmitHandler", () => {
  it("routes lines starting with ! to handleBangLine", () => {
    const editor = {
      setText: vi.fn(),
      addToHistory: vi.fn(),
    };
    const handleCommand = vi.fn();
    const sendMessage = vi.fn();
    const handleBangLine = vi.fn();

    const onSubmit = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine,
    });

    onSubmit("!ls");

    expect(handleBangLine).toHaveBeenCalledTimes(1);
    expect(handleBangLine).toHaveBeenCalledWith("!ls");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(handleCommand).not.toHaveBeenCalled();
  });

  it("treats a lone ! as a normal message", () => {
    const editor = {
      setText: vi.fn(),
      addToHistory: vi.fn(),
    };
    const handleCommand = vi.fn();
    const sendMessage = vi.fn();
    const handleBangLine = vi.fn();

    const onSubmit = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine,
    });

    onSubmit("!");

    expect(handleBangLine).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith("!");
  });

  it("does not treat leading whitespace before ! as a bang command", () => {
    const editor = {
      setText: vi.fn(),
      addToHistory: vi.fn(),
    };
    const handleCommand = vi.fn();
    const sendMessage = vi.fn();
    const handleBangLine = vi.fn();

    const onSubmit = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine,
    });

    onSubmit("  !ls");

    expect(handleBangLine).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith("!ls");
    expect(editor.addToHistory).toHaveBeenCalledWith("!ls");
  });

  it("trims normal messages before sending and adding to history", () => {
    const editor = {
      setText: vi.fn(),
      addToHistory: vi.fn(),
    };
    const handleCommand = vi.fn();
    const sendMessage = vi.fn();
    const handleBangLine = vi.fn();

    const onSubmit = createEditorSubmitHandler({
      editor,
      handleCommand,
      sendMessage,
      handleBangLine,
    });

    onSubmit("  hello  ");

    expect(sendMessage).toHaveBeenCalledWith("hello");
    expect(editor.addToHistory).toHaveBeenCalledWith("hello");
  });
});
