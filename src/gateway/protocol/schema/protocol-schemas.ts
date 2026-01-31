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

import type { TSchema } from "@sinclair/typebox";

import {
  AgentEventSchema,
  AgentIdentityParamsSchema,
  AgentIdentityResultSchema,
  AgentParamsSchema,
  AgentWaitParamsSchema,
  PollParamsSchema,
  SendParamsSchema,
  WakeParamsSchema,
} from "./agent.js";
import {
  AgentSummarySchema,
  AgentsListParamsSchema,
  AgentsListResultSchema,
  ModelChoiceSchema,
  ModelsListParamsSchema,
  ModelsListResultSchema,
  SkillsBinsParamsSchema,
  SkillsBinsResultSchema,
  SkillsInstallParamsSchema,
  SkillsStatusParamsSchema,
  SkillsUpdateParamsSchema,
} from "./agents-models-skills.js";
import {
  ChannelsLogoutParamsSchema,
  ChannelsStatusParamsSchema,
  ChannelsStatusResultSchema,
  TalkModeParamsSchema,
  WebLoginStartParamsSchema,
  WebLoginWaitParamsSchema,
} from "./channels.js";
import {
  ConfigApplyParamsSchema,
  ConfigGetParamsSchema,
  ConfigPatchParamsSchema,
  ConfigSchemaParamsSchema,
  ConfigSchemaResponseSchema,
  ConfigSetParamsSchema,
  UpdateRunParamsSchema,
} from "./config.js";
import {
  CronAddParamsSchema,
  CronJobSchema,
  CronListParamsSchema,
  CronRemoveParamsSchema,
  CronRunLogEntrySchema,
  CronRunParamsSchema,
  CronRunsParamsSchema,
  CronStatusParamsSchema,
  CronUpdateParamsSchema,
} from "./cron.js";
import {
  ExecApprovalsGetParamsSchema,
  ExecApprovalsNodeGetParamsSchema,
  ExecApprovalsNodeSetParamsSchema,
  ExecApprovalsSetParamsSchema,
  ExecApprovalsSnapshotSchema,
  ExecApprovalRequestParamsSchema,
  ExecApprovalResolveParamsSchema,
} from "./exec-approvals.js";
import {
  DevicePairApproveParamsSchema,
  DevicePairListParamsSchema,
  DevicePairRejectParamsSchema,
  DevicePairRequestedEventSchema,
  DevicePairResolvedEventSchema,
  DeviceTokenRevokeParamsSchema,
  DeviceTokenRotateParamsSchema,
} from "./devices.js";
import {
  ConnectParamsSchema,
  ErrorShapeSchema,
  EventFrameSchema,
  GatewayFrameSchema,
  HelloOkSchema,
  RequestFrameSchema,
  ResponseFrameSchema,
  ShutdownEventSchema,
  TickEventSchema,
} from "./frames.js";
import {
  ChatAbortParamsSchema,
  ChatEventSchema,
  ChatHistoryParamsSchema,
  ChatInjectParamsSchema,
  ChatSendParamsSchema,
  LogsTailParamsSchema,
  LogsTailResultSchema,
} from "./logs-chat.js";
import {
  NodeDescribeParamsSchema,
  NodeEventParamsSchema,
  NodeInvokeParamsSchema,
  NodeInvokeResultParamsSchema,
  NodeInvokeRequestEventSchema,
  NodeListParamsSchema,
  NodePairApproveParamsSchema,
  NodePairListParamsSchema,
  NodePairRejectParamsSchema,
  NodePairRequestParamsSchema,
  NodePairVerifyParamsSchema,
  NodeRenameParamsSchema,
} from "./nodes.js";
import {
  SessionsCompactParamsSchema,
  SessionsDeleteParamsSchema,
  SessionsListParamsSchema,
  SessionsPatchParamsSchema,
  SessionsPreviewParamsSchema,
  SessionsResetParamsSchema,
  SessionsResolveParamsSchema,
} from "./sessions.js";
import { PresenceEntrySchema, SnapshotSchema, StateVersionSchema } from "./snapshot.js";
import {
  WizardCancelParamsSchema,
  WizardNextParamsSchema,
  WizardNextResultSchema,
  WizardStartParamsSchema,
  WizardStartResultSchema,
  WizardStatusParamsSchema,
  WizardStatusResultSchema,
  WizardStepSchema,
} from "./wizard.js";

export const ProtocolSchemas: Record<string, TSchema> = {
  ConnectParams: ConnectParamsSchema,
  HelloOk: HelloOkSchema,
  RequestFrame: RequestFrameSchema,
  ResponseFrame: ResponseFrameSchema,
  EventFrame: EventFrameSchema,
  GatewayFrame: GatewayFrameSchema,
  PresenceEntry: PresenceEntrySchema,
  StateVersion: StateVersionSchema,
  Snapshot: SnapshotSchema,
  ErrorShape: ErrorShapeSchema,
  AgentEvent: AgentEventSchema,
  SendParams: SendParamsSchema,
  PollParams: PollParamsSchema,
  AgentParams: AgentParamsSchema,
  AgentIdentityParams: AgentIdentityParamsSchema,
  AgentIdentityResult: AgentIdentityResultSchema,
  AgentWaitParams: AgentWaitParamsSchema,
  WakeParams: WakeParamsSchema,
  NodePairRequestParams: NodePairRequestParamsSchema,
  NodePairListParams: NodePairListParamsSchema,
  NodePairApproveParams: NodePairApproveParamsSchema,
  NodePairRejectParams: NodePairRejectParamsSchema,
  NodePairVerifyParams: NodePairVerifyParamsSchema,
  NodeRenameParams: NodeRenameParamsSchema,
  NodeListParams: NodeListParamsSchema,
  NodeDescribeParams: NodeDescribeParamsSchema,
  NodeInvokeParams: NodeInvokeParamsSchema,
  NodeInvokeResultParams: NodeInvokeResultParamsSchema,
  NodeEventParams: NodeEventParamsSchema,
  NodeInvokeRequestEvent: NodeInvokeRequestEventSchema,
  SessionsListParams: SessionsListParamsSchema,
  SessionsPreviewParams: SessionsPreviewParamsSchema,
  SessionsResolveParams: SessionsResolveParamsSchema,
  SessionsPatchParams: SessionsPatchParamsSchema,
  SessionsResetParams: SessionsResetParamsSchema,
  SessionsDeleteParams: SessionsDeleteParamsSchema,
  SessionsCompactParams: SessionsCompactParamsSchema,
  ConfigGetParams: ConfigGetParamsSchema,
  ConfigSetParams: ConfigSetParamsSchema,
  ConfigApplyParams: ConfigApplyParamsSchema,
  ConfigPatchParams: ConfigPatchParamsSchema,
  ConfigSchemaParams: ConfigSchemaParamsSchema,
  ConfigSchemaResponse: ConfigSchemaResponseSchema,
  WizardStartParams: WizardStartParamsSchema,
  WizardNextParams: WizardNextParamsSchema,
  WizardCancelParams: WizardCancelParamsSchema,
  WizardStatusParams: WizardStatusParamsSchema,
  WizardStep: WizardStepSchema,
  WizardNextResult: WizardNextResultSchema,
  WizardStartResult: WizardStartResultSchema,
  WizardStatusResult: WizardStatusResultSchema,
  TalkModeParams: TalkModeParamsSchema,
  ChannelsStatusParams: ChannelsStatusParamsSchema,
  ChannelsStatusResult: ChannelsStatusResultSchema,
  ChannelsLogoutParams: ChannelsLogoutParamsSchema,
  WebLoginStartParams: WebLoginStartParamsSchema,
  WebLoginWaitParams: WebLoginWaitParamsSchema,
  AgentSummary: AgentSummarySchema,
  AgentsListParams: AgentsListParamsSchema,
  AgentsListResult: AgentsListResultSchema,
  ModelChoice: ModelChoiceSchema,
  ModelsListParams: ModelsListParamsSchema,
  ModelsListResult: ModelsListResultSchema,
  SkillsStatusParams: SkillsStatusParamsSchema,
  SkillsBinsParams: SkillsBinsParamsSchema,
  SkillsBinsResult: SkillsBinsResultSchema,
  SkillsInstallParams: SkillsInstallParamsSchema,
  SkillsUpdateParams: SkillsUpdateParamsSchema,
  CronJob: CronJobSchema,
  CronListParams: CronListParamsSchema,
  CronStatusParams: CronStatusParamsSchema,
  CronAddParams: CronAddParamsSchema,
  CronUpdateParams: CronUpdateParamsSchema,
  CronRemoveParams: CronRemoveParamsSchema,
  CronRunParams: CronRunParamsSchema,
  CronRunsParams: CronRunsParamsSchema,
  CronRunLogEntry: CronRunLogEntrySchema,
  LogsTailParams: LogsTailParamsSchema,
  LogsTailResult: LogsTailResultSchema,
  ExecApprovalsGetParams: ExecApprovalsGetParamsSchema,
  ExecApprovalsSetParams: ExecApprovalsSetParamsSchema,
  ExecApprovalsNodeGetParams: ExecApprovalsNodeGetParamsSchema,
  ExecApprovalsNodeSetParams: ExecApprovalsNodeSetParamsSchema,
  ExecApprovalsSnapshot: ExecApprovalsSnapshotSchema,
  ExecApprovalRequestParams: ExecApprovalRequestParamsSchema,
  ExecApprovalResolveParams: ExecApprovalResolveParamsSchema,
  DevicePairListParams: DevicePairListParamsSchema,
  DevicePairApproveParams: DevicePairApproveParamsSchema,
  DevicePairRejectParams: DevicePairRejectParamsSchema,
  DeviceTokenRotateParams: DeviceTokenRotateParamsSchema,
  DeviceTokenRevokeParams: DeviceTokenRevokeParamsSchema,
  DevicePairRequestedEvent: DevicePairRequestedEventSchema,
  DevicePairResolvedEvent: DevicePairResolvedEventSchema,
  ChatHistoryParams: ChatHistoryParamsSchema,
  ChatSendParams: ChatSendParamsSchema,
  ChatAbortParams: ChatAbortParamsSchema,
  ChatInjectParams: ChatInjectParamsSchema,
  ChatEvent: ChatEventSchema,
  UpdateRunParams: UpdateRunParamsSchema,
  TickEvent: TickEventSchema,
  ShutdownEvent: ShutdownEventSchema,
};

export const PROTOCOL_VERSION = 3 as const;
