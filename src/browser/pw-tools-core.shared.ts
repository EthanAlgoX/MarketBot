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

import { parseRoleRef } from "./pw-role-snapshot.js";

let nextUploadArmId = 0;
let nextDialogArmId = 0;
let nextDownloadArmId = 0;

export function bumpUploadArmId(): number {
  nextUploadArmId += 1;
  return nextUploadArmId;
}

export function bumpDialogArmId(): number {
  nextDialogArmId += 1;
  return nextDialogArmId;
}

export function bumpDownloadArmId(): number {
  nextDownloadArmId += 1;
  return nextDownloadArmId;
}

export function requireRef(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const roleRef = raw ? parseRoleRef(raw) : null;
  const ref = roleRef ?? (raw.startsWith("@") ? raw.slice(1) : raw);
  if (!ref) {
    throw new Error("ref is required");
  }
  return ref;
}

export function normalizeTimeoutMs(timeoutMs: number | undefined, fallback: number) {
  return Math.max(500, Math.min(120_000, timeoutMs ?? fallback));
}

export function toAIFriendlyError(error: unknown, selector: string): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("strict mode violation")) {
    const countMatch = message.match(/resolved to (\d+) elements/);
    const count = countMatch ? countMatch[1] : "multiple";
    return new Error(
      `Selector "${selector}" matched ${count} elements. ` +
        `Run a new snapshot to get updated refs, or use a different ref.`,
    );
  }

  if (
    (message.includes("Timeout") || message.includes("waiting for")) &&
    (message.includes("to be visible") || message.includes("not visible"))
  ) {
    return new Error(
      `Element "${selector}" not found or not visible. ` +
        `Run a new snapshot to see current page elements.`,
    );
  }

  if (
    message.includes("intercepts pointer events") ||
    message.includes("not visible") ||
    message.includes("not receive pointer events")
  ) {
    return new Error(
      `Element "${selector}" is not interactable (hidden or covered). ` +
        `Try scrolling it into view, closing overlays, or re-snapshotting.`,
    );
  }

  return error instanceof Error ? error : new Error(message);
}
