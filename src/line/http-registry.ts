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

import type { IncomingMessage, ServerResponse } from "node:http";

export type LineHttpRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void> | void;

type RegisterLineHttpHandlerArgs = {
  path?: string | null;
  handler: LineHttpRequestHandler;
  log?: (message: string) => void;
  accountId?: string;
};

const lineHttpRoutes = new Map<string, LineHttpRequestHandler>();

export function normalizeLineWebhookPath(path?: string | null): string {
  const trimmed = path?.trim();
  if (!trimmed) {
    return "/line/webhook";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function registerLineHttpHandler(params: RegisterLineHttpHandlerArgs): () => void {
  const normalizedPath = normalizeLineWebhookPath(params.path);
  if (lineHttpRoutes.has(normalizedPath)) {
    const suffix = params.accountId ? ` for account "${params.accountId}"` : "";
    params.log?.(`line: webhook path ${normalizedPath} already registered${suffix}`);
    return () => {};
  }
  lineHttpRoutes.set(normalizedPath, params.handler);
  return () => {
    lineHttpRoutes.delete(normalizedPath);
  };
}

export async function handleLineHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const handler = lineHttpRoutes.get(url.pathname);
  if (!handler) {
    return false;
  }
  await handler(req, res);
  return true;
}
