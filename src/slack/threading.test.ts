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

import { describe, expect, it } from "vitest";

import { resolveSlackThreadContext, resolveSlackThreadTargets } from "./threading.js";

describe("resolveSlackThreadTargets", () => {
  it("threads replies when message is already threaded", () => {
    const { replyThreadTs, statusThreadTs } = resolveSlackThreadTargets({
      replyToMode: "off",
      message: {
        type: "message",
        channel: "C1",
        ts: "123",
        thread_ts: "456",
      },
    });

    expect(replyThreadTs).toBe("456");
    expect(statusThreadTs).toBe("456");
  });

  it("threads top-level replies when mode is all", () => {
    const { replyThreadTs, statusThreadTs } = resolveSlackThreadTargets({
      replyToMode: "all",
      message: {
        type: "message",
        channel: "C1",
        ts: "123",
      },
    });

    expect(replyThreadTs).toBe("123");
    expect(statusThreadTs).toBe("123");
  });

  it("keeps status threading even when reply threading is off", () => {
    const { replyThreadTs, statusThreadTs } = resolveSlackThreadTargets({
      replyToMode: "off",
      message: {
        type: "message",
        channel: "C1",
        ts: "123",
      },
    });

    expect(replyThreadTs).toBeUndefined();
    expect(statusThreadTs).toBe("123");
  });

  it("sets messageThreadId for top-level messages when replyToMode is all", () => {
    const context = resolveSlackThreadContext({
      replyToMode: "all",
      message: {
        type: "message",
        channel: "C1",
        ts: "123",
      },
    });

    expect(context.isThreadReply).toBe(false);
    expect(context.messageThreadId).toBe("123");
    expect(context.replyToId).toBe("123");
  });

  it("prefers thread_ts as messageThreadId for replies", () => {
    const context = resolveSlackThreadContext({
      replyToMode: "off",
      message: {
        type: "message",
        channel: "C1",
        ts: "123",
        thread_ts: "456",
      },
    });

    expect(context.isThreadReply).toBe(true);
    expect(context.messageThreadId).toBe("456");
    expect(context.replyToId).toBe("456");
  });
});
