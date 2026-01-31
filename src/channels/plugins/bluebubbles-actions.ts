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

import type { ChannelMessageActionName } from "./types.js";

export type BlueBubblesActionSpec = {
  gate: string;
  groupOnly?: boolean;
  unsupportedOnMacOS26?: boolean;
};

export const BLUEBUBBLES_ACTIONS = {
  react: { gate: "reactions" },
  edit: { gate: "edit", unsupportedOnMacOS26: true },
  unsend: { gate: "unsend" },
  reply: { gate: "reply" },
  sendWithEffect: { gate: "sendWithEffect" },
  renameGroup: { gate: "renameGroup", groupOnly: true },
  setGroupIcon: { gate: "setGroupIcon", groupOnly: true },
  addParticipant: { gate: "addParticipant", groupOnly: true },
  removeParticipant: { gate: "removeParticipant", groupOnly: true },
  leaveGroup: { gate: "leaveGroup", groupOnly: true },
  sendAttachment: { gate: "sendAttachment" },
} as const satisfies Partial<Record<ChannelMessageActionName, BlueBubblesActionSpec>>;

const BLUEBUBBLES_ACTION_SPECS = BLUEBUBBLES_ACTIONS as Record<
  keyof typeof BLUEBUBBLES_ACTIONS,
  BlueBubblesActionSpec
>;

export const BLUEBUBBLES_ACTION_NAMES = Object.keys(
  BLUEBUBBLES_ACTIONS,
) as (keyof typeof BLUEBUBBLES_ACTIONS)[];

export const BLUEBUBBLES_GROUP_ACTIONS = new Set<ChannelMessageActionName>(
  BLUEBUBBLES_ACTION_NAMES.filter((action) => BLUEBUBBLES_ACTION_SPECS[action]?.groupOnly),
);
