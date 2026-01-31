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

import { readChannelAllowFromStore } from "../../pairing/pairing-store.js";

import { allowListMatches, normalizeAllowList, normalizeAllowListLower } from "./allow-list.js";
import type { SlackMonitorContext } from "./context.js";

export async function resolveSlackEffectiveAllowFrom(ctx: SlackMonitorContext) {
  const storeAllowFrom = await readChannelAllowFromStore("slack").catch(() => []);
  const allowFrom = normalizeAllowList([...ctx.allowFrom, ...storeAllowFrom]);
  const allowFromLower = normalizeAllowListLower(allowFrom);
  return { allowFrom, allowFromLower };
}

export function isSlackSenderAllowListed(params: {
  allowListLower: string[];
  senderId: string;
  senderName?: string;
}) {
  const { allowListLower, senderId, senderName } = params;
  return (
    allowListLower.length === 0 ||
    allowListMatches({
      allowList: allowListLower,
      id: senderId,
      name: senderName,
    })
  );
}
