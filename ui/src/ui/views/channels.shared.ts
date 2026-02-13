import { html, nothing } from "lit";

import type { ChannelAccountSnapshot } from "../types";
import type { ChannelKey, ChannelsProps } from "./channels.types";

export type ChannelsLanguage = "en" | "zh";

type ChannelsText = {
  yes: string;
  no: string;
  notAvailable: string;
  configured: string;
  running: string;
  connected: string;
  linked: string;
  mode: string;
  lastStart: string;
  lastProbe: string;
  lastInbound: string;
  lastConnect: string;
  lastMessage: string;
  authAge: string;
  baseUrl: string;
  credential: string;
  audience: string;
  probe: string;
  probeOk: string;
  probeFailed: string;
  refresh: string;
  probeButton: string;
  working: string;
  showQr: string;
  relink: string;
  waitForScan: string;
  logout: string;
  accounts: (count: number) => string;
  loadingConfigSchema: string;
  schemaUnavailable: string;
  channelSchemaUnavailable: string;
  saving: string;
  save: string;
  reload: string;
};

const CHANNELS_TEXT: Record<ChannelsLanguage, ChannelsText> = {
  en: {
    yes: "Yes",
    no: "No",
    notAvailable: "n/a",
    configured: "Configured",
    running: "Running",
    connected: "Connected",
    linked: "Linked",
    mode: "Mode",
    lastStart: "Last start",
    lastProbe: "Last probe",
    lastInbound: "Last inbound",
    lastConnect: "Last connect",
    lastMessage: "Last message",
    authAge: "Auth age",
    baseUrl: "Base URL",
    credential: "Credential",
    audience: "Audience",
    probe: "Probe",
    probeOk: "ok",
    probeFailed: "failed",
    refresh: "Refresh",
    probeButton: "Probe",
    working: "Working…",
    showQr: "Show QR",
    relink: "Relink",
    waitForScan: "Wait for scan",
    logout: "Logout",
    accounts: (count: number) => `Accounts (${count})`,
    loadingConfigSchema: "Loading config schema…",
    schemaUnavailable: "Schema unavailable. Use Raw.",
    channelSchemaUnavailable: "Channel config schema unavailable.",
    saving: "Saving…",
    save: "Save",
    reload: "Reload",
  },
  zh: {
    yes: "是",
    no: "否",
    notAvailable: "暂无",
    configured: "已配置",
    running: "运行中",
    connected: "已连接",
    linked: "已绑定",
    mode: "模式",
    lastStart: "最近启动",
    lastProbe: "最近探测",
    lastInbound: "最近入站",
    lastConnect: "最近连接",
    lastMessage: "最近消息",
    authAge: "认证时长",
    baseUrl: "基础地址",
    credential: "凭据",
    audience: "受众",
    probe: "探测",
    probeOk: "成功",
    probeFailed: "失败",
    refresh: "刷新",
    probeButton: "探测",
    working: "处理中…",
    showQr: "显示二维码",
    relink: "重新绑定",
    waitForScan: "等待扫码",
    logout: "登出",
    accounts: (count: number) => `账号（${count}）`,
    loadingConfigSchema: "正在加载配置 Schema…",
    schemaUnavailable: "Schema 不可用，请切换 Raw。",
    channelSchemaUnavailable: "渠道配置 Schema 不可用。",
    saving: "保存中…",
    save: "保存",
    reload: "重载",
  },
};

export function resolveChannelsLanguage(
  source?: Pick<ChannelsProps, "language"> | ChannelsLanguage | null,
): ChannelsLanguage {
  if (typeof source === "string") return source === "zh" ? "zh" : "en";
  const value = source?.language;
  return value === "zh" ? "zh" : "en";
}

export function resolveChannelsText(
  source?: Pick<ChannelsProps, "language"> | ChannelsLanguage | null,
): ChannelsText {
  const language = resolveChannelsLanguage(source);
  return CHANNELS_TEXT[language];
}

export function formatDuration(ms?: number | null, source?: Pick<ChannelsProps, "language"> | ChannelsLanguage | null) {
  const text = resolveChannelsText(source);
  if (!ms && ms !== 0) return text.notAvailable;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  return `${hr}h`;
}

export function channelEnabled(key: ChannelKey, props: ChannelsProps) {
  const snapshot = props.snapshot;
  const channels = snapshot?.channels as Record<string, unknown> | null;
  if (!snapshot || !channels) return false;
  const channelStatus = channels[key] as Record<string, unknown> | undefined;
  const configured = typeof channelStatus?.configured === "boolean" && channelStatus.configured;
  const running = typeof channelStatus?.running === "boolean" && channelStatus.running;
  const connected = typeof channelStatus?.connected === "boolean" && channelStatus.connected;
  const accounts = snapshot.channelAccounts?.[key] ?? [];
  const accountActive = accounts.some(
    (account) => account.configured || account.running || account.connected,
  );
  return configured || running || connected || accountActive;
}

export function getChannelAccountCount(
  key: ChannelKey,
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null,
): number {
  return channelAccounts?.[key]?.length ?? 0;
}

export function renderChannelAccountCount(
  key: ChannelKey,
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null,
  source?: Pick<ChannelsProps, "language"> | ChannelsLanguage | null,
) {
  const text = resolveChannelsText(source);
  const count = getChannelAccountCount(key, channelAccounts);
  if (count < 2) return nothing;
  return html`<div class="account-count">${text.accounts(count)}</div>`;
}
