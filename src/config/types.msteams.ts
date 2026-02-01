import type { ChannelHeartbeatVisibilityConfig } from "./types.channels.js";
import type { DmConfig } from "./types.messages.js";
import type { GroupToolPolicyBySenderConfig, GroupToolPolicyConfig } from "./types.tools.js";
import type {
  MarkdownConfig,
  DmPolicy,
  GroupPolicy,
  BlockStreamingCoalesceConfig,
} from "./types.base.js";

export type MSTeamsWebhookConfig = {
  port?: number;
  path?: string;
};

export type MSTeamsReplyStyle = "thread" | "top-level";

export type MSTeamsChannelConfig = {
  requireMention?: boolean;
  tools?: GroupToolPolicyConfig;
  toolsBySender?: GroupToolPolicyBySenderConfig;
  replyStyle?: MSTeamsReplyStyle;
};

export type MSTeamsTeamConfig = {
  requireMention?: boolean;
  tools?: GroupToolPolicyConfig;
  toolsBySender?: GroupToolPolicyBySenderConfig;
  replyStyle?: MSTeamsReplyStyle;
  channels?: Record<string, MSTeamsChannelConfig>;
};

export type MSTeamsConfig = {
  enabled?: boolean;
  capabilities?: string[];
  markdown?: MarkdownConfig;
  configWrites?: boolean;
  appId?: string;
  appPassword?: string;
  tenantId?: string;
  webhook?: MSTeamsWebhookConfig;
  dmPolicy?: DmPolicy;
  allowFrom?: Array<string>;
  groupAllowFrom?: Array<string>;
  groupPolicy?: GroupPolicy;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
  mediaAllowHosts?: Array<string>;
  requireMention?: boolean;
  historyLimit?: number;
  dmHistoryLimit?: number;
  dms?: Record<string, DmConfig>;
  replyStyle?: MSTeamsReplyStyle;
  teams?: Record<string, MSTeamsTeamConfig>;
  mediaMaxMb?: number;
  sharePointSiteId?: string;
  heartbeat?: ChannelHeartbeatVisibilityConfig;
};
