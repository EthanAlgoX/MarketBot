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

import { listChannelPlugins } from "../channels/plugins/index.js";
import type { ChannelAccountSnapshot, ChannelStatusIssue } from "../channels/plugins/types.js";

export function collectChannelStatusIssues(payload: Record<string, unknown>): ChannelStatusIssue[] {
  const issues: ChannelStatusIssue[] = [];
  const accountsByChannel = payload.channelAccounts as Record<string, unknown> | undefined;
  for (const plugin of listChannelPlugins()) {
    const collect = plugin.status?.collectStatusIssues;
    if (!collect) {
      continue;
    }
    const raw = accountsByChannel?.[plugin.id];
    if (!Array.isArray(raw)) {
      continue;
    }

    issues.push(...collect(raw as ChannelAccountSnapshot[]));
  }
  return issues;
}
