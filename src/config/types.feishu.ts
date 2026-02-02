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

import type { GroupPolicy } from "./types.base.js";

export type FeishuConnectionMode = "websocket" | "webhook";
export type FeishuDomain = "feishu" | "lark";
export type FeishuDmPolicy = "open" | "pairing" | "allowlist";
export type FeishuGroupPolicy = "open" | "allowlist" | "disabled";
export type FeishuRenderMode = "auto" | "raw" | "card";

export type FeishuGroupConfig = {
  chatId: string;
  requireMention?: boolean;
  historyLimit?: number;
  allowFrom?: Array<string | number>;
  toolPolicy?: GroupPolicy;
};

export type FeishuConfig = {
  enabled?: boolean;
  appId?: string;
  appSecret?: string;
  encryptKey?: string;
  verificationToken?: string;
  domain?: FeishuDomain;
  connectionMode?: FeishuConnectionMode;
  webhookPath?: string;
  webhookPort?: number;
  dmPolicy?: FeishuDmPolicy;
  allowFrom?: Array<string | number>;
  groupPolicy?: FeishuGroupPolicy;
  groupAllowFrom?: Array<string | number>;
  requireMention?: boolean;
  historyLimit?: number;
  dmHistoryLimit?: number;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  mediaMaxMb?: number;
  renderMode?: FeishuRenderMode;
  groups?: FeishuGroupConfig[];
};
