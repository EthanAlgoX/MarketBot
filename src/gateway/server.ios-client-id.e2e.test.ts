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

import { afterAll, beforeAll, test } from "vitest";
import WebSocket from "ws";

import { PROTOCOL_VERSION } from "./protocol/index.js";
import { getFreePort, onceMessage, startGatewayServer } from "./test-helpers.server.js";

let server: Awaited<ReturnType<typeof startGatewayServer>>;
let port = 0;

beforeAll(async () => {
  port = await getFreePort();
  server = await startGatewayServer(port);
});

afterAll(async () => {
  await server.close();
});

function connectReq(
  ws: WebSocket,
  params: { clientId: string; platform: string; token?: string; password?: string },
): Promise<{ ok: boolean; error?: { message?: string } }> {
  const id = `c-${Math.random().toString(16).slice(2)}`;
  ws.send(
    JSON.stringify({
      type: "req",
      id,
      method: "connect",
      params: {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: params.clientId,
          version: "dev",
          platform: params.platform,
          mode: "node",
        },
        auth: {
          token: params.token,
          password: params.password,
        },
        role: "node",
        scopes: [],
        caps: ["canvas"],
        commands: ["system.notify"],
        permissions: {},
      },
    }),
  );

  return onceMessage(
    ws,
    (o) => (o as { type?: string }).type === "res" && (o as { id?: string }).id === id,
  );
}

test("accepts marketbot-ios as a valid gateway client id", async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve) => ws.once("open", resolve));

  const res = await connectReq(ws, { clientId: "marketbot-ios", platform: "ios" });
  // We don't care if auth fails here; we only care that schema validation accepts the client id.
  // A schema rejection would close the socket before sending a response.
  if (!res.ok) {
    // allow unauthorized error when gateway requires auth
    // but reject schema validation errors
    const message = String(res.error?.message ?? "");
    if (message.includes("invalid connect params")) {
      throw new Error(message);
    }
  }

  ws.close();
});

test("accepts marketbot-android as a valid gateway client id", async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve) => ws.once("open", resolve));

  const res = await connectReq(ws, { clientId: "marketbot-android", platform: "android" });
  // We don't care if auth fails here; we only care that schema validation accepts the client id.
  // A schema rejection would close the socket before sending a response.
  if (!res.ok) {
    // allow unauthorized error when gateway requires auth
    // but reject schema validation errors
    const message = String(res.error?.message ?? "");
    if (message.includes("invalid connect params")) {
      throw new Error(message);
    }
  }

  ws.close();
});
