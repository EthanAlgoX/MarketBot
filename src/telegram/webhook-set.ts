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

import { type ApiClientOptions, Bot } from "grammy";
import type { TelegramNetworkConfig } from "../config/types.telegram.js";
import { resolveTelegramFetch } from "./fetch.js";
import { withTelegramApiErrorLogging } from "./api-logging.js";

export async function setTelegramWebhook(opts: {
  token: string;
  url: string;
  secret?: string;
  dropPendingUpdates?: boolean;
  network?: TelegramNetworkConfig;
}) {
  const fetchImpl = resolveTelegramFetch(undefined, { network: opts.network });
  const client: ApiClientOptions | undefined = fetchImpl
    ? { fetch: fetchImpl as unknown as ApiClientOptions["fetch"] }
    : undefined;
  const bot = new Bot(opts.token, client ? { client } : undefined);
  await withTelegramApiErrorLogging({
    operation: "setWebhook",
    fn: () =>
      bot.api.setWebhook(opts.url, {
        secret_token: opts.secret,
        drop_pending_updates: opts.dropPendingUpdates ?? false,
      }),
  });
}

export async function deleteTelegramWebhook(opts: {
  token: string;
  network?: TelegramNetworkConfig;
}) {
  const fetchImpl = resolveTelegramFetch(undefined, { network: opts.network });
  const client: ApiClientOptions | undefined = fetchImpl
    ? { fetch: fetchImpl as unknown as ApiClientOptions["fetch"] }
    : undefined;
  const bot = new Bot(opts.token, client ? { client } : undefined);
  await withTelegramApiErrorLogging({
    operation: "deleteWebhook",
    fn: () => bot.api.deleteWebhook(),
  });
}
