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

import { Box, Container, Key, Markdown, Spacer, Text, matchesKey } from "@mariozechner/pi-tui";
import { markdownTheme, theme } from "../theme/theme.js";

type InfoPanelOptions = {
  onClose?: () => void;
  footer?: string;
};

export class InfoPanel extends Container {
  private box: Box;
  private title: Text;
  private body: Markdown;
  private footer?: Text;
  private onClose?: () => void;

  constructor(title: string, body: string, opts: InfoPanelOptions = {}) {
    super();
    this.onClose = opts.onClose;
    this.box = new Box(1, 1, (line) => theme.overlayBg(line));
    this.title = new Text(theme.overlayTitle(title), 0, 0);
    this.body = new Markdown(body, 0, 0, markdownTheme, {
      color: (line) => theme.fg(line),
    });
    this.box.addChild(this.title);
    this.box.addChild(new Spacer(1));
    this.box.addChild(this.body);
    if (opts.footer) {
      this.footer = new Text(theme.dim(opts.footer), 0, 0);
      this.box.addChild(new Spacer(1));
      this.box.addChild(this.footer);
    }
    this.addChild(this.box);
  }

  setTitle(title: string) {
    this.title.setText(theme.overlayTitle(title));
  }

  setBody(body: string) {
    this.body.setText(body);
  }

  setFooter(text?: string) {
    if (!text) {
      return;
    }
    if (!this.footer) {
      this.footer = new Text(theme.dim(text), 0, 0);
      this.box.addChild(new Spacer(1));
      this.box.addChild(this.footer);
      return;
    }
    this.footer.setText(theme.dim(text));
  }

  handleInput(data: string): void {
    if (
      matchesKey(data, Key.escape) ||
      matchesKey(data, Key.ctrl("c")) ||
      matchesKey(data, Key.enter)
    ) {
      this.onClose?.();
    }
  }
}
