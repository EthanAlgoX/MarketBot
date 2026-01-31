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

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { BrowserRouteContext } from "../server-context.js";
import { handleRouteError, readBody, requirePwAi, resolveProfileContext } from "./agent.shared.js";
import { toBoolean, toStringOrEmpty } from "./utils.js";
import type { BrowserRouteRegistrar } from "./types.js";

export function registerBrowserAgentDebugRoutes(
  app: BrowserRouteRegistrar,
  ctx: BrowserRouteContext,
) {
  app.get("/console", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const targetId = typeof req.query.targetId === "string" ? req.query.targetId.trim() : "";
    const level = typeof req.query.level === "string" ? req.query.level : "";

    try {
      const tab = await profileCtx.ensureTabAvailable(targetId || undefined);
      const pw = await requirePwAi(res, "console messages");
      if (!pw) {
        return;
      }
      const messages = await pw.getConsoleMessagesViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        level: level.trim() || undefined,
      });
      res.json({ ok: true, messages, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.get("/errors", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const targetId = typeof req.query.targetId === "string" ? req.query.targetId.trim() : "";
    const clear = toBoolean(req.query.clear) ?? false;

    try {
      const tab = await profileCtx.ensureTabAvailable(targetId || undefined);
      const pw = await requirePwAi(res, "page errors");
      if (!pw) {
        return;
      }
      const result = await pw.getPageErrorsViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        clear,
      });
      res.json({ ok: true, targetId: tab.targetId, ...result });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.get("/requests", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const targetId = typeof req.query.targetId === "string" ? req.query.targetId.trim() : "";
    const filter = typeof req.query.filter === "string" ? req.query.filter : "";
    const clear = toBoolean(req.query.clear) ?? false;

    try {
      const tab = await profileCtx.ensureTabAvailable(targetId || undefined);
      const pw = await requirePwAi(res, "network requests");
      if (!pw) {
        return;
      }
      const result = await pw.getNetworkRequestsViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        filter: filter.trim() || undefined,
        clear,
      });
      res.json({ ok: true, targetId: tab.targetId, ...result });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/trace/start", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    const screenshots = toBoolean(body.screenshots) ?? undefined;
    const snapshots = toBoolean(body.snapshots) ?? undefined;
    const sources = toBoolean(body.sources) ?? undefined;
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, "trace start");
      if (!pw) {
        return;
      }
      await pw.traceStartViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        screenshots,
        snapshots,
        sources,
      });
      res.json({ ok: true, targetId: tab.targetId });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });

  app.post("/trace/stop", async (req, res) => {
    const profileCtx = resolveProfileContext(req, res, ctx);
    if (!profileCtx) {
      return;
    }
    const body = readBody(req);
    const targetId = toStringOrEmpty(body.targetId) || undefined;
    const out = toStringOrEmpty(body.path) || "";
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const pw = await requirePwAi(res, "trace stop");
      if (!pw) {
        return;
      }
      const id = crypto.randomUUID();
      const dir = "/tmp/marketbot";
      await fs.mkdir(dir, { recursive: true });
      const tracePath = out.trim() || path.join(dir, `browser-trace-${id}.zip`);
      await pw.traceStopViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        path: tracePath,
      });
      res.json({
        ok: true,
        targetId: tab.targetId,
        path: path.resolve(tracePath),
      });
    } catch (err) {
      handleRouteError(ctx, res, err);
    }
  });
}
