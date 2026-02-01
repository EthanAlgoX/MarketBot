import type { ChannelHeartbeatVisibilityConfig } from "./types.channels.js";
import type { DmConfig } from "./types.messages.js";
import type { MarkdownConfig, DmPolicy, GroupPolicy } from "./types.base.js";

export type MattermostConfig = {
  enabled?: boolean;
  baseUrl?: string;
  botToken?: string;
  webhookPath?: string;
  team?: string;
  dmPolicy?: DmPolicy;
  allowFrom?: Array<string>;
  groupPolicy?: GroupPolicy;
  historyLimit?: number;
  dmHistoryLimit?: number;
  dms?: Record<string, DmConfig>;
  heartbeat?: ChannelHeartbeatVisibilityConfig;
};
