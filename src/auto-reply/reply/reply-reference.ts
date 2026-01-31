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

import type { ReplyToMode } from "../../config/types.js";

export type ReplyReferencePlanner = {
  /** Returns the effective reply/thread id for the next send and updates state. */
  use(): string | undefined;
  /** Mark that a reply was sent (needed when no reference is used). */
  markSent(): void;
  /** Whether a reply has been sent in this flow. */
  hasReplied(): boolean;
};

export function createReplyReferencePlanner(options: {
  replyToMode: ReplyToMode;
  /** Existing thread/reference id (always used when present). */
  existingId?: string;
  /** Id to start a new thread/reference when allowed (e.g., parent message id). */
  startId?: string;
  /** Disable reply references entirely (e.g., when posting inside a new thread). */
  allowReference?: boolean;
  /** Seed the planner with prior reply state. */
  hasReplied?: boolean;
}): ReplyReferencePlanner {
  let hasReplied = options.hasReplied ?? false;
  const allowReference = options.allowReference !== false;
  const existingId = options.existingId?.trim();
  const startId = options.startId?.trim();

  const use = (): string | undefined => {
    if (!allowReference) {
      return undefined;
    }
    if (existingId) {
      hasReplied = true;
      return existingId;
    }
    if (!startId) {
      return undefined;
    }
    if (options.replyToMode === "off") {
      return undefined;
    }
    if (options.replyToMode === "all") {
      hasReplied = true;
      return startId;
    }
    if (!hasReplied) {
      hasReplied = true;
      return startId;
    }
    return undefined;
  };

  const markSent = () => {
    hasReplied = true;
  };

  return {
    use,
    markSent,
    hasReplied: () => hasReplied,
  };
}
