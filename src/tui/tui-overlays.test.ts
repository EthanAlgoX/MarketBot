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

import type { Component } from "@mariozechner/pi-tui";
import { describe, expect, it, vi } from "vitest";

import { createOverlayHandlers } from "./tui-overlays.js";

class DummyComponent implements Component {
  render() {
    return ["dummy"];
  }

  invalidate() {}
}

describe("createOverlayHandlers", () => {
  it("routes overlays through the TUI overlay stack", () => {
    const showOverlay = vi.fn();
    const hideOverlay = vi.fn();
    const setFocus = vi.fn();
    let open = false;

    const host = {
      showOverlay: (component: Component) => {
        open = true;
        showOverlay(component);
      },
      hideOverlay: () => {
        open = false;
        hideOverlay();
      },
      hasOverlay: () => open,
      setFocus,
    };

    const { openOverlay, closeOverlay } = createOverlayHandlers(host, new DummyComponent());
    const overlay = new DummyComponent();

    openOverlay(overlay);
    expect(showOverlay).toHaveBeenCalledWith(overlay);

    closeOverlay();
    expect(hideOverlay).toHaveBeenCalledTimes(1);
    expect(setFocus).not.toHaveBeenCalled();
  });

  it("restores focus when closing without an overlay", () => {
    const setFocus = vi.fn();
    const host = {
      showOverlay: vi.fn(),
      hideOverlay: vi.fn(),
      hasOverlay: () => false,
      setFocus,
    };
    const fallback = new DummyComponent();

    const { closeOverlay } = createOverlayHandlers(host, fallback);
    closeOverlay();

    expect(setFocus).toHaveBeenCalledWith(fallback);
  });
});
