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

import { describe, expect, it, vi } from "vitest";

import { expectInboundContextContract } from "../../../../test/helpers/inbound-contract.js";

let capturedCtx: unknown;

vi.mock("../../../auto-reply/reply/provider-dispatcher.js", () => ({
  dispatchReplyWithBufferedBlockDispatcher: vi.fn(async (params: { ctx: unknown }) => {
    capturedCtx = params.ctx;
    return { queuedFinal: false };
  }),
}));

import { processMessage } from "./process-message.js";

describe("web processMessage inbound contract", () => {
  it("passes a finalized MsgContext to the dispatcher", async () => {
    capturedCtx = undefined;

    await processMessage({
      cfg: { messages: {} } as any,
      msg: {
        id: "msg1",
        from: "123@g.us",
        to: "+15550001111",
        chatType: "group",
        body: "hi",
        senderName: "Alice",
        senderJid: "alice@s.whatsapp.net",
        senderE164: "+15550002222",
        groupSubject: "Test Group",
        groupParticipants: [],
      } as any,
      route: {
        agentId: "main",
        accountId: "default",
        sessionKey: "agent:main:whatsapp:group:123",
      } as any,
      groupHistoryKey: "123@g.us",
      groupHistories: new Map(),
      groupMemberNames: new Map(),
      connectionId: "conn",
      verbose: false,
      maxMediaBytes: 1,
      replyResolver: (async () => undefined) as any,
      replyLogger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any,
      backgroundTasks: new Set(),
      rememberSentText: (_text: string | undefined, _opts: unknown) => {},
      echoHas: () => false,
      echoForget: () => {},
      buildCombinedEchoKey: () => "echo",
      groupHistory: [],
    } as any);

    expect(capturedCtx).toBeTruthy();
    expectInboundContextContract(capturedCtx as any);
  });
});
