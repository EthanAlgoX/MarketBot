import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketBotConfig } from "marketbot/plugin-sdk";

import { createFeishuClient } from "./client.js";
import { sendMessageFeishu } from "./send.js";

vi.mock("./client.js", () => ({
  createFeishuClient: vi.fn(),
}));

vi.mock("./runtime.js", () => ({
  getFeishuRuntime: () => ({
    stable: {
      channel: {
        text: {
          resolveMarkdownTableMode: () => "code",
          convertMarkdownTables: (text: string) => text,
        },
      },
    },
  }),
}));

describe("feishu send", () => {
  const mockCreateFeishuClient = vi.mocked(createFeishuClient);
  const cfg = {
    channels: {
      feishu: {
        appId: "app-id",
        appSecret: "app-secret",
      },
    },
  } as unknown as MarketBotConfig;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts SDK success response without code field", async () => {
    const create = vi.fn(async () => ({ data: { message_id: "om_success" } }));
    mockCreateFeishuClient.mockReturnValue({
      im: {
        message: {
          create,
        },
      },
    } as unknown as ReturnType<typeof createFeishuClient>);

    const result = await sendMessageFeishu({
      cfg,
      to: "ou_user_1",
      text: "hello",
    });

    expect(result).toEqual({
      messageId: "om_success",
      chatId: "ou_user_1",
    });
  });

  it("throws when SDK returns explicit non-zero code", async () => {
    const create = vi.fn(async () => ({ code: 99991663, msg: "forbidden" }));
    mockCreateFeishuClient.mockReturnValue({
      im: {
        message: {
          create,
        },
      },
    } as unknown as ReturnType<typeof createFeishuClient>);

    await expect(
      sendMessageFeishu({
        cfg,
        to: "ou_user_1",
        text: "hello",
      }),
    ).rejects.toThrow("Feishu send failed: forbidden");
  });
});
