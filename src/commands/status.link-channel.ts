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

import { resolveChannelDefaultAccountId } from "../channels/plugins/helpers.js";
import { listChannelPlugins } from "../channels/plugins/index.js";
import type { ChannelAccountSnapshot, ChannelPlugin } from "../channels/plugins/types.js";
import type { MarketBotConfig } from "../config/config.js";

export type LinkChannelContext = {
  linked: boolean;
  authAgeMs: number | null;
  account?: unknown;
  accountId?: string;
  plugin: ChannelPlugin;
};

export async function resolveLinkChannelContext(
  cfg: MarketBotConfig,
): Promise<LinkChannelContext | null> {
  for (const plugin of listChannelPlugins()) {
    const accountIds = plugin.config.listAccountIds(cfg);
    const defaultAccountId = resolveChannelDefaultAccountId({
      plugin,
      cfg,
      accountIds,
    });
    const account = plugin.config.resolveAccount(cfg, defaultAccountId);
    const enabled = plugin.config.isEnabled ? plugin.config.isEnabled(account, cfg) : true;
    const configured = plugin.config.isConfigured
      ? await plugin.config.isConfigured(account, cfg)
      : true;
    const snapshot = plugin.config.describeAccount
      ? plugin.config.describeAccount(account, cfg)
      : ({
          accountId: defaultAccountId,
          enabled,
          configured,
        } as ChannelAccountSnapshot);
    const summary = plugin.status?.buildChannelSummary
      ? await plugin.status.buildChannelSummary({
          account,
          cfg,
          defaultAccountId,
          snapshot,
        })
      : undefined;
    const summaryRecord = summary;
    const linked =
      summaryRecord && typeof summaryRecord.linked === "boolean" ? summaryRecord.linked : null;
    if (linked === null) {
      continue;
    }
    const authAgeMs =
      summaryRecord && typeof summaryRecord.authAgeMs === "number" ? summaryRecord.authAgeMs : null;
    return { linked, authAgeMs, account, accountId: defaultAccountId, plugin };
  }
  return null;
}
