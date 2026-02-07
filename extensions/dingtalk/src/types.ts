import type { z } from "zod";

import type { DingTalkConfigSchema } from "./config-schema.js";

export type DingTalkConfig = z.infer<typeof DingTalkConfigSchema>;
export type DingTalkAccountConfig = Omit<DingTalkConfig, "accounts" | "defaultAccount">;

export type ResolvedDingTalkAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  config: DingTalkAccountConfig;
};

export type DingTalkInboundMessage = {
  msgId?: string;
  conversationType?: string;
  conversationId?: string;
  senderId?: string;
  senderNick?: string;
  text?: { content?: string };
  msgtype?: string;
  sessionWebhook?: string;
};

