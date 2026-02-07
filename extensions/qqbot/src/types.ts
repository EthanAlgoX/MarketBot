import type { z } from "zod";

import type { QQBotConfigSchema } from "./config-schema.js";

export type QQBotConfig = z.infer<typeof QQBotConfigSchema>;
export type QQBotAccountConfig = Omit<QQBotConfig, "accounts" | "defaultAccount">;

export type ResolvedQQBotAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  config: QQBotAccountConfig;
};

export type WSPayload = {
  op: number;
  t?: string;
  s?: number;
  d?: unknown;
};

export type C2CMessageEvent = {
  id: string;
  timestamp: string;
  content: string;
  author: { user_openid: string };
};

export type GroupMessageEvent = {
  id: string;
  timestamp: string;
  content: string;
  group_openid: string;
  author: { member_openid: string };
};

export type GuildMessageEvent = {
  id: string;
  timestamp: string;
  content: string;
  channel_id: string;
  guild_id: string;
  author: { id: string; username: string };
};

