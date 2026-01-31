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

import type { Component, TUI } from "@mariozechner/pi-tui";
import type { ChatLog } from "./components/chat-log.js";
import { InfoPanel } from "./components/info-panel.js";
import { createSearchableSelectList, createTextInputOverlay } from "./components/selectors.js";
import type {
  WizardConfirmParams,
  WizardMultiSelectParams,
  WizardPrompter,
  WizardSelectParams,
  WizardTextParams,
} from "../wizard/prompts.js";
import { WizardCancelledError } from "../wizard/prompts.js";

type TuiPromptContext = {
  tui: TUI;
  chatLog: ChatLog;
  openOverlay: (component: Component) => void;
  closeOverlay: () => void;
};

export function createTuiWizardPrompter(context: TuiPromptContext): WizardPrompter {
  const { tui, chatLog, openOverlay, closeOverlay } = context;

  const showInfoPanel = (title: string, body: string, footer?: string) =>
    new Promise<void>((resolve) => {
      const panel = new InfoPanel(title, body, {
        footer: footer ?? "Enter/Esc to close",
        onClose: () => {
          closeOverlay();
          tui.requestRender();
          resolve();
        },
      });
      openOverlay(panel);
      tui.requestRender();
    });

  const selectValue = async <T>(params: WizardSelectParams<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      chatLog.addSystem(params.message);
      const items = params.options.map((opt) => ({
        value: opt.value as unknown as string,
        label: opt.label,
        description: opt.hint ?? "",
      }));
      const selector = createSearchableSelectList(items, 9);
      if (params.initialValue !== undefined) {
        const index = params.options.findIndex((opt) => opt.value === params.initialValue);
        if (index >= 0) {
          selector.setSelectedIndex(index);
        }
      }
      selector.onSelect = (item) => {
        closeOverlay();
        tui.requestRender();
        resolve(item.value as unknown as T);
      };
      selector.onCancel = () => {
        closeOverlay();
        tui.requestRender();
        reject(new WizardCancelledError("wizard cancelled"));
      };
      openOverlay(selector);
      tui.requestRender();
    });

  const promptText = async (params: WizardTextParams): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const overlay = createTextInputOverlay(tui, params.message, params.initialValue ?? "");
      overlay.onCommit = (value) => {
        const error = params.validate?.(value);
        if (error) {
          chatLog.addSystem(error);
          tui.requestRender();
          return;
        }
        closeOverlay();
        tui.requestRender();
        resolve(value);
      };
      overlay.onCancel = () => {
        closeOverlay();
        tui.requestRender();
        reject(new WizardCancelledError("wizard cancelled"));
      };
      openOverlay(overlay);
      tui.setFocus(overlay.getEditor());
      tui.requestRender();
    });

  const confirmValue = async (params: WizardConfirmParams): Promise<boolean> => {
    const initial = params.initialValue ?? false;
    const selection = await selectValue<boolean>({
      message: params.message,
      options: [
        { value: true, label: "Yes" },
        { value: false, label: "No" },
      ],
      initialValue: initial,
    });
    return selection;
  };

  const multiselectValue = async <T>(params: WizardMultiSelectParams<T>): Promise<T[]> => {
    const raw = await promptText({
      message: params.message,
      placeholder: "comma-separated values",
      initialValue: params.initialValues?.map((v) => String(v)).join(", ") ?? "",
    });
    const values = raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (values.length === 0) {
      return [];
    }
    const allowed = new Map(params.options.map((opt) => [String(opt.value), opt.value]));
    return values
      .map((value) => allowed.get(value))
      .filter((value): value is T => value !== undefined);
  };

  return {
    intro: async (title: string) => {
      chatLog.addSystem(title);
      tui.requestRender();
    },
    outro: async (message: string) => {
      chatLog.addSystem(message);
      tui.requestRender();
    },
    note: async (message: string, title?: string) => showInfoPanel(title ?? "Note", message),
    select: selectValue,
    multiselect: multiselectValue,
    text: promptText,
    confirm: confirmValue,
    progress: (label: string) => {
      const panel = new InfoPanel(label, "", { footer: "Esc to close" });
      openOverlay(panel);
      tui.requestRender();
      return {
        update: (message: string) => {
          panel.setBody(message);
          tui.requestRender();
        },
        stop: (message?: string) => {
          if (message) {
            panel.setBody(message);
          }
          closeOverlay();
          tui.requestRender();
        },
      };
    },
  };
}
