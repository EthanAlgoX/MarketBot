import type { ChannelHeartbeatVisibilityConfig } from "./types.channels.js";
import type { DmConfig } from "./types.messages.js";
import type { GroupToolPolicyBySenderConfig, GroupToolPolicyConfig } from "./types.tools.js";
import type {
  MarkdownConfig,
  DmPolicy,
  GroupPolicy,
  BlockStreamingCoalesceConfig,
} from "./types.base.js";

export type BlueBubblesActionConfig = {
  reactions?: boolean;
  edit?: boolean;
  unsend?: boolean;
  reply?: boolean;
  sendWithEffect?: boolean;
  renameGroup?: boolean;
  setGroupIcon?: boolean;
  addParticipant?: boolean;
  removeParticipant?: boolean;
  leaveGroup?: boolean;
  sendAttachment?: boolean;
};

export type BlueBubblesGroupConfig = {
  requireMention?: boolean;
  tools?: GroupToolPolicyConfig;
  toolsBySender?: GroupToolPolicyBySenderConfig;
};

export type BlueBubblesAccountConfig = {
  name?: string;
  capabilities?: string[];
  markdown?: MarkdownConfig;
  configWrites?: boolean;
  enabled?: boolean;
  serverUrl?: string;
  password?: string;
  webhookPath?: string;
  dmPolicy?: DmPolicy;
  allowFrom?: Array<string | number>;
  groupAllowFrom?: Array<string | number>;
  groupPolicy?: GroupPolicy;
  historyLimit?: number;
  dmHistoryLimit?: number;
  dms?: Record<string, DmConfig>;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  mediaMaxMb?: number;
  sendReadReceipts?: boolean;
  blockStreaming?: boolean;
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
  groups?: Record<string, BlueBubblesGroupConfig>;
  heartbeat?: ChannelHeartbeatVisibilityConfig;
};

export type BlueBubblesConfig = BlueBubblesAccountConfig & {
  accounts?: Record<string, BlueBubblesAccountConfig>;
  actions?: BlueBubblesActionConfig;
};
