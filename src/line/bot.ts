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

import type { WebhookRequestBody } from "@line/bot-sdk";
import type { MarketBotConfig } from "../config/config.js";
import { loadConfig } from "../config/config.js";
import { logVerbose } from "../globals.js";
import type { RuntimeEnv } from "../runtime.js";
import { resolveLineAccount } from "./accounts.js";
import { handleLineWebhookEvents } from "./bot-handlers.js";
import type { LineInboundContext } from "./bot-message-context.js";
import { startLineWebhook } from "./webhook.js";
import type { ResolvedLineAccount } from "./types.js";

export interface LineBotOptions {
  channelAccessToken: string;
  channelSecret: string;
  accountId?: string;
  runtime?: RuntimeEnv;
  config?: MarketBotConfig;
  mediaMaxMb?: number;
  onMessage?: (ctx: LineInboundContext) => Promise<void>;
}

export interface LineBot {
  handleWebhook: (body: WebhookRequestBody) => Promise<void>;
  account: ResolvedLineAccount;
}

export function createLineBot(opts: LineBotOptions): LineBot {
  const runtime: RuntimeEnv = opts.runtime ?? {
    log: console.log,
    error: console.error,
    exit: (code: number): never => {
      throw new Error(`exit ${code}`);
    },
  };

  const cfg = opts.config ?? loadConfig();
  const account = resolveLineAccount({
    cfg,
    accountId: opts.accountId,
  });

  const mediaMaxBytes = (opts.mediaMaxMb ?? account.config.mediaMaxMb ?? 10) * 1024 * 1024;

  const processMessage =
    opts.onMessage ??
    (async () => {
      logVerbose("line: no message handler configured");
    });

  const handleWebhook = async (body: WebhookRequestBody): Promise<void> => {
    if (!body.events || body.events.length === 0) {
      return;
    }

    await handleLineWebhookEvents(body.events, {
      cfg,
      account,
      runtime,
      mediaMaxBytes,
      processMessage,
    });
  };

  return {
    handleWebhook,
    account,
  };
}

export function createLineWebhookCallback(
  bot: LineBot,
  channelSecret: string,
  path = "/line/webhook",
) {
  const { handler } = startLineWebhook({
    channelSecret,
    onEvents: bot.handleWebhook,
    path,
  });

  return { path, handler };
}
