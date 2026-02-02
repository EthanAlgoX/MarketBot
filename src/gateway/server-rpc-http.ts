/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { handleGatewayRequest } from "./server-methods.js";
import type { GatewayRequestHandlers } from "./server-methods/types.js";
import { readJsonBody } from "./hooks.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("gateway/rpc-http");

export async function handleRpcHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    extraHandlers?: GatewayRequestHandlers;
    broadcast: (event: string, payload: unknown) => void;
    context: any;
  },
): Promise<boolean> {
  const url = req.url ?? "/";
  if (!url.startsWith("/api/")) {
    return false;
  }

  const method = url.slice(5); // Remove "/api/"
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return true;
  }

  try {
    const bodyResult = await readJsonBody(req, 10 * 1024 * 1024);
    if (!bodyResult.ok) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: bodyResult.error }));
      return true;
    }

    const body = bodyResult.value as { params?: any };

    await handleGatewayRequest({
      req: { method, params: body.params, type: "req", id: `http-${Date.now()}` },
      respond: (ok, result, error) => {
        res.statusCode = ok ? 200 : 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok, result, error }));
      },
      client: {
        connect: {
          role: "operator",
          scopes: ["operator.admin", "operator.read", "operator.write"],
        },
      } as any,
      isWebchatConnect: () => false,
      context: opts.context,
      extraHandlers: opts.extraHandlers,
    });

    return true;
  } catch (err) {
    log.error(`RPC HTTP failed: ${String(err)}`);
    res.statusCode = 500;
    res.end("Internal Server Error");
    return true;
  }
}
