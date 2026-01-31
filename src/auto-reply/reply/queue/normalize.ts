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

import type { QueueDropPolicy, QueueMode } from "./types.js";

export function normalizeQueueMode(raw?: string): QueueMode | undefined {
  if (!raw) {
    return undefined;
  }
  const cleaned = raw.trim().toLowerCase();
  if (cleaned === "queue" || cleaned === "queued") {
    return "steer";
  }
  if (cleaned === "interrupt" || cleaned === "interrupts" || cleaned === "abort") {
    return "interrupt";
  }
  if (cleaned === "steer" || cleaned === "steering") {
    return "steer";
  }
  if (cleaned === "followup" || cleaned === "follow-ups" || cleaned === "followups") {
    return "followup";
  }
  if (cleaned === "collect" || cleaned === "coalesce") {
    return "collect";
  }
  if (cleaned === "steer+backlog" || cleaned === "steer-backlog" || cleaned === "steer_backlog") {
    return "steer-backlog";
  }
  return undefined;
}

export function normalizeQueueDropPolicy(raw?: string): QueueDropPolicy | undefined {
  if (!raw) {
    return undefined;
  }
  const cleaned = raw.trim().toLowerCase();
  if (cleaned === "old" || cleaned === "oldest") {
    return "old";
  }
  if (cleaned === "new" || cleaned === "newest") {
    return "new";
  }
  if (cleaned === "summarize" || cleaned === "summary") {
    return "summarize";
  }
  return undefined;
}
