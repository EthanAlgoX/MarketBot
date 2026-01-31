/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { Box, Container, Key, Text, matchesKey, type TUI } from "@mariozechner/pi-tui";
import { editorTheme, theme } from "../theme/theme.js";
import { CustomEditor } from "./custom-editor.js";

export class TextInputOverlay extends Container {
  private box: Box;
  private title: Text;
  private editor: CustomEditor;
  private footer: Text;

  onCommit?: (value: string) => void;
  onCancel?: () => void;

  constructor(tui: TUI, label: string, initialValue = "") {
    super();

    this.box = new Box(1, 1, (line) => theme.overlayBg(line));
    this.title = new Text(theme.overlayTitle(label), 0, 0);
    this.editor = new CustomEditor(tui, editorTheme);
    this.editor.setText(initialValue);
    this.footer = new Text(theme.dim("Enter to commit | Esc to cancel"), 0, 0);

    this.box.addChild(this.title);
    this.box.addChild(this.editor);
    this.box.addChild(this.footer);
    this.addChild(this.box);

    this.editor.onSubmit = (text) => {
      this.onCommit?.(text.trim());
    };
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
      return;
    }
    // Most input is handled by the focused child (the editor)
    // but we need to ensure the editor is focused when the overlay is shown.
  }

  getEditor() {
    return this.editor;
  }
}
