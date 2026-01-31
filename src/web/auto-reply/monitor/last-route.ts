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

import type { MsgContext } from "../../../auto-reply/templating.js";
import type { loadConfig } from "../../../config/config.js";
import { resolveStorePath, updateLastRoute } from "../../../config/sessions.js";
import { formatError } from "../../session.js";

export function trackBackgroundTask(
  backgroundTasks: Set<Promise<unknown>>,
  task: Promise<unknown>,
) {
  backgroundTasks.add(task);
  void task.finally(() => {
    backgroundTasks.delete(task);
  });
}

export function updateLastRouteInBackground(params: {
  cfg: ReturnType<typeof loadConfig>;
  backgroundTasks: Set<Promise<unknown>>;
  storeAgentId: string;
  sessionKey: string;
  channel: "whatsapp";
  to: string;
  accountId?: string;
  ctx?: MsgContext;
  warn: (obj: unknown, msg: string) => void;
}) {
  const storePath = resolveStorePath(params.cfg.session?.store, {
    agentId: params.storeAgentId,
  });
  const task = updateLastRoute({
    storePath,
    sessionKey: params.sessionKey,
    deliveryContext: {
      channel: params.channel,
      to: params.to,
      accountId: params.accountId,
    },
    ctx: params.ctx,
  }).catch((err) => {
    params.warn(
      {
        error: formatError(err),
        storePath,
        sessionKey: params.sessionKey,
        to: params.to,
      },
      "failed updating last route",
    );
  });
  trackBackgroundTask(params.backgroundTasks, task);
}

export function awaitBackgroundTasks(backgroundTasks: Set<Promise<unknown>>) {
  if (backgroundTasks.size === 0) {
    return Promise.resolve();
  }
  return Promise.allSettled(backgroundTasks).then(() => {
    backgroundTasks.clear();
  });
}
