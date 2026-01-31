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

import { type ChannelId, getChannelPlugin } from "../../channels/plugins/index.js";
import { formatCliCommand } from "../../cli/command-format.js";
import { type MarketBotConfig, readConfigFileSnapshot } from "../../config/config.js";
import { DEFAULT_ACCOUNT_ID } from "../../routing/session-key.js";
import { defaultRuntime, type RuntimeEnv } from "../../runtime.js";

export type ChatChannel = ChannelId;

export async function requireValidConfig(
  runtime: RuntimeEnv = defaultRuntime,
): Promise<MarketBotConfig | null> {
  const snapshot = await readConfigFileSnapshot();
  if (snapshot.exists && !snapshot.valid) {
    const issues =
      snapshot.issues.length > 0
        ? snapshot.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")
        : "Unknown validation issue.";
    runtime.error(`Config invalid:\n${issues}`);
    runtime.error(`Fix the config or run ${formatCliCommand("marketbot doctor")}.`);
    runtime.exit(1);
    return null;
  }
  return snapshot.config;
}

export function formatAccountLabel(params: { accountId: string; name?: string }) {
  const base = params.accountId || DEFAULT_ACCOUNT_ID;
  if (params.name?.trim()) {
    return `${base} (${params.name.trim()})`;
  }
  return base;
}

export const channelLabel = (channel: ChatChannel) => {
  const plugin = getChannelPlugin(channel);
  return plugin?.meta.label ?? channel;
};

export function formatChannelAccountLabel(params: {
  channel: ChatChannel;
  accountId: string;
  name?: string;
  channelStyle?: (value: string) => string;
  accountStyle?: (value: string) => string;
}): string {
  const channelText = channelLabel(params.channel);
  const accountText = formatAccountLabel({
    accountId: params.accountId,
    name: params.name,
  });
  const styledChannel = params.channelStyle ? params.channelStyle(channelText) : channelText;
  const styledAccount = params.accountStyle ? params.accountStyle(accountText) : accountText;
  return `${styledChannel} ${styledAccount}`;
}

export function shouldUseWizard(params?: { hasFlags?: boolean }) {
  return params?.hasFlags === false;
}
