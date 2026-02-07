import type { z } from "zod";

import type { MarketBotConfig } from "marketbot/plugin-sdk";

import type { WecomConfigSchema } from "./config-schema.js";

export type WecomConfig = z.infer<typeof WecomConfigSchema>;
export type WecomAccountConfig = Omit<WecomConfig, "accounts" | "defaultAccount">;

export type ResolvedWecomAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  config: WecomAccountConfig;
};

export type WecomRuntimeEnv = {
  log?: (message: string) => void;
  error?: (message: string) => void;
};

export type WecomWebhookTarget = {
  account: ResolvedWecomAccount;
  config: MarketBotConfig;
  runtime: WecomRuntimeEnv;
  token: string;
  encodingAesKey: string;
  corpId: string;
  path: string;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

