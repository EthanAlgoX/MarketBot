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

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CliDeps } from "../cli/deps.js";
import type { MarketBotConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { SessionEntry } from "../config/sessions.js";

const mocks = vi.hoisted(() => ({
  deliverOutboundPayloads: vi.fn(async () => []),
  getChannelPlugin: vi.fn(() => ({})),
  resolveOutboundTarget: vi.fn(() => ({ ok: true as const, to: "+15551234567" })),
}));

vi.mock("../channels/plugins/index.js", () => ({
  getChannelPlugin: mocks.getChannelPlugin,
  normalizeChannelId: (value: string) => value,
}));

vi.mock("../infra/outbound/deliver.js", () => ({
  deliverOutboundPayloads: mocks.deliverOutboundPayloads,
}));

vi.mock("../infra/outbound/targets.js", async () => {
  const actual = await vi.importActual<typeof import("../infra/outbound/targets.js")>(
    "../infra/outbound/targets.js",
  );
  return {
    ...actual,
    resolveOutboundTarget: mocks.resolveOutboundTarget,
  };
});

describe("deliverAgentCommandResult", () => {
  beforeEach(() => {
    mocks.deliverOutboundPayloads.mockClear();
    mocks.resolveOutboundTarget.mockClear();
  });

  it("prefers explicit accountId for outbound delivery", async () => {
    const cfg = {} as MarketBotConfig;
    const deps = {} as CliDeps;
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const sessionEntry = {
      lastAccountId: "default",
    } as SessionEntry;
    const result = {
      payloads: [{ text: "hi" }],
      meta: {},
    };

    const { deliverAgentCommandResult } = await import("./agent/delivery.js");
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: "hello",
        deliver: true,
        channel: "whatsapp",
        accountId: "kev",
        to: "+15551234567",
      },
      sessionEntry,
      result,
      payloads: result.payloads,
    });

    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "kev" }),
    );
  });

  it("falls back to session accountId for implicit delivery", async () => {
    const cfg = {} as MarketBotConfig;
    const deps = {} as CliDeps;
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const sessionEntry = {
      lastAccountId: "legacy",
      lastChannel: "whatsapp",
    } as SessionEntry;
    const result = {
      payloads: [{ text: "hi" }],
      meta: {},
    };

    const { deliverAgentCommandResult } = await import("./agent/delivery.js");
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: "hello",
        deliver: true,
        channel: "whatsapp",
      },
      sessionEntry,
      result,
      payloads: result.payloads,
    });

    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "legacy" }),
    );
  });

  it("does not infer accountId for explicit delivery targets", async () => {
    const cfg = {} as MarketBotConfig;
    const deps = {} as CliDeps;
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const sessionEntry = {
      lastAccountId: "legacy",
    } as SessionEntry;
    const result = {
      payloads: [{ text: "hi" }],
      meta: {},
    };

    const { deliverAgentCommandResult } = await import("./agent/delivery.js");
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: "hello",
        deliver: true,
        channel: "whatsapp",
        to: "+15551234567",
        deliveryTargetMode: "explicit",
      },
      sessionEntry,
      result,
      payloads: result.payloads,
    });

    expect(mocks.resolveOutboundTarget).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: undefined, mode: "explicit" }),
    );
    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: undefined }),
    );
  });

  it("skips session accountId when channel differs", async () => {
    const cfg = {} as MarketBotConfig;
    const deps = {} as CliDeps;
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const sessionEntry = {
      lastAccountId: "legacy",
      lastChannel: "telegram",
    } as SessionEntry;
    const result = {
      payloads: [{ text: "hi" }],
      meta: {},
    };

    const { deliverAgentCommandResult } = await import("./agent/delivery.js");
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: "hello",
        deliver: true,
        channel: "whatsapp",
      },
      sessionEntry,
      result,
      payloads: result.payloads,
    });

    expect(mocks.resolveOutboundTarget).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: undefined, channel: "whatsapp" }),
    );
  });

  it("uses session last channel when none is provided", async () => {
    const cfg = {} as MarketBotConfig;
    const deps = {} as CliDeps;
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const sessionEntry = {
      lastChannel: "telegram",
      lastTo: "123",
    } as SessionEntry;
    const result = {
      payloads: [{ text: "hi" }],
      meta: {},
    };

    const { deliverAgentCommandResult } = await import("./agent/delivery.js");
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: "hello",
        deliver: true,
      },
      sessionEntry,
      result,
      payloads: result.payloads,
    });

    expect(mocks.resolveOutboundTarget).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "telegram", to: "123" }),
    );
  });

  it("uses reply overrides for delivery routing", async () => {
    const cfg = {} as MarketBotConfig;
    const deps = {} as CliDeps;
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const sessionEntry = {
      lastChannel: "telegram",
      lastTo: "123",
      lastAccountId: "legacy",
    } as SessionEntry;
    const result = {
      payloads: [{ text: "hi" }],
      meta: {},
    };

    const { deliverAgentCommandResult } = await import("./agent/delivery.js");
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: "hello",
        deliver: true,
        to: "+15551234567",
        replyTo: "#reports",
        replyChannel: "slack",
        replyAccountId: "ops",
      },
      sessionEntry,
      result,
      payloads: result.payloads,
    });

    expect(mocks.resolveOutboundTarget).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "slack", to: "#reports", accountId: "ops" }),
    );
  });

  it("condenses external delivery payloads to a result-focused reply", async () => {
    const cfg = {} as MarketBotConfig;
    const deps = {} as CliDeps;
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const result = {
      payloads: [
        { text: "我来帮您完成这个任务。让我先搜索：" },
        {
          text: "很好！美股七姐妹包括：1. Alphabet (GOOGL) 2. 亚马逊 (AMZN) 3. 苹果 (AAPL) 4. Meta (META) 5. 微软 (MSFT) 6. NVIDIA (NVDA) 7. Tesla (TSLA)",
        },
        { text: "⚠️ 🛠️ Exec: python3 mag7.py failed: missing scipy" },
      ],
      meta: { aborted: true },
    };

    const { deliverAgentCommandResult } = await import("./agent/delivery.js");
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: "hello",
        deliver: true,
        channel: "feishu",
        to: "ou_test",
      },
      sessionEntry: undefined,
      result,
      payloads: result.payloads,
    });

    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledTimes(1);
    const call = mocks.deliverOutboundPayloads.mock.calls[0]?.[0] as {
      payloads: Array<{ text: string; mediaUrls?: string[] }>;
    };
    expect(call.payloads).toHaveLength(1);
    expect(call.payloads[0]?.text ?? "").toContain("GOOGL");
    expect(call.payloads[0]?.text ?? "").toContain("任务执行超时");
  });

  it("keeps media payloads and drops progress chatter for external delivery", async () => {
    const cfg = {} as MarketBotConfig;
    const deps = {} as CliDeps;
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const result = {
      payloads: [
        { text: "让我先整理数据：" },
        { text: "图表已生成。", mediaUrl: "https://example.com/mag7.png" },
      ],
      meta: { aborted: false },
    };

    const { deliverAgentCommandResult } = await import("./agent/delivery.js");
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: "hello",
        deliver: true,
        channel: "feishu",
        to: "ou_test",
      },
      sessionEntry: undefined,
      result,
      payloads: result.payloads,
    });

    expect(mocks.deliverOutboundPayloads).toHaveBeenCalledTimes(1);
    const call = mocks.deliverOutboundPayloads.mock.calls[0]?.[0] as {
      payloads: Array<{ text: string; mediaUrls?: string[] }>;
    };
    expect(call.payloads).toHaveLength(1);
    expect(call.payloads[0]?.mediaUrls ?? []).toEqual(["https://example.com/mag7.png"]);
  });

  it("prefixes nested agent outputs with context", async () => {
    const cfg = {} as MarketBotConfig;
    const deps = {} as CliDeps;
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
    } as unknown as RuntimeEnv;
    const result = {
      payloads: [{ text: "ANNOUNCE_SKIP" }],
      meta: {},
    };

    const { deliverAgentCommandResult } = await import("./agent/delivery.js");
    await deliverAgentCommandResult({
      cfg,
      deps,
      runtime,
      opts: {
        message: "hello",
        deliver: false,
        lane: "nested",
        sessionKey: "agent:main:main",
        runId: "run-announce",
        messageChannel: "webchat",
      },
      sessionEntry: undefined,
      result,
      payloads: result.payloads,
    });

    expect(runtime.log).toHaveBeenCalledTimes(1);
    const line = String(runtime.log.mock.calls[0]?.[0]);
    expect(line).toContain("[agent:nested]");
    expect(line).toContain("session=agent:main:main");
    expect(line).toContain("run=run-announce");
    expect(line).toContain("channel=webchat");
    expect(line).toContain("ANNOUNCE_SKIP");
  });
});
