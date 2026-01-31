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

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
const { getBotInfoMock, MessagingApiClientMock } = vi.hoisted(() => {
  const getBotInfoMock = vi.fn();
  const MessagingApiClientMock = vi.fn(function () {
    return { getBotInfo: getBotInfoMock };
  });
  return { getBotInfoMock, MessagingApiClientMock };
});

vi.mock("@line/bot-sdk", () => ({
  messagingApi: { MessagingApiClient: MessagingApiClientMock },
}));

let probeLineBot: typeof import("./probe.js").probeLineBot;

afterEach(() => {
  vi.useRealTimers();
  getBotInfoMock.mockReset();
});

describe("probeLineBot", () => {
  beforeAll(async () => {
    ({ probeLineBot } = await import("./probe.js"));
  });

  it("returns timeout when bot info stalls", async () => {
    vi.useFakeTimers();
    getBotInfoMock.mockImplementation(() => new Promise(() => {}));

    const probePromise = probeLineBot("token", 10);
    await vi.advanceTimersByTimeAsync(20);
    const result = await probePromise;

    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });

  it("returns bot info when available", async () => {
    getBotInfoMock.mockResolvedValue({
      displayName: "MarketBot",
      userId: "U123",
      basicId: "@marketbot",
      pictureUrl: "https://example.com/bot.png",
    });

    const result = await probeLineBot("token", 50);

    expect(result.ok).toBe(true);
    expect(result.bot?.userId).toBe("U123");
  });
});
