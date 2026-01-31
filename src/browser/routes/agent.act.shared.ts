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

export const ACT_KINDS = [
  "click",
  "close",
  "drag",
  "evaluate",
  "fill",
  "hover",
  "scrollIntoView",
  "press",
  "resize",
  "select",
  "type",
  "wait",
] as const;

export type ActKind = (typeof ACT_KINDS)[number];

export function isActKind(value: unknown): value is ActKind {
  if (typeof value !== "string") {
    return false;
  }
  return (ACT_KINDS as readonly string[]).includes(value);
}

export type ClickButton = "left" | "right" | "middle";
export type ClickModifier = "Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift";

const ALLOWED_CLICK_MODIFIERS = new Set<ClickModifier>([
  "Alt",
  "Control",
  "ControlOrMeta",
  "Meta",
  "Shift",
]);

export function parseClickButton(raw: string): ClickButton | undefined {
  if (raw === "left" || raw === "right" || raw === "middle") {
    return raw;
  }
  return undefined;
}

export function parseClickModifiers(raw: string[]): {
  modifiers?: ClickModifier[];
  error?: string;
} {
  const invalid = raw.filter((m) => !ALLOWED_CLICK_MODIFIERS.has(m as ClickModifier));
  if (invalid.length) {
    return { error: "modifiers must be Alt|Control|ControlOrMeta|Meta|Shift" };
  }
  return { modifiers: raw.length ? (raw as ClickModifier[]) : undefined };
}
