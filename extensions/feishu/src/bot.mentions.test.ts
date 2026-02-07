import { describe, expect, it } from "vitest";

import { parseFeishuMessageEvent, type FeishuMessageEvent } from "./bot.js";

function makeEvent(partial: Partial<FeishuMessageEvent>): FeishuMessageEvent {
  return partial as FeishuMessageEvent;
}

describe("feishu mention detection", () => {
  it("treats bot as mentioned when mention key includes bot open_id", () => {
    const botOpenId = "ou_bot_open_id_123";
    const event = makeEvent({
      message: {
        chat_id: "oc_chat_1",
        message_id: "om_msg_1",
        chat_type: "group",
        message_type: "text",
        content: JSON.stringify({ text: "@bot hi" }),
        mentions: [
          {
            key: `<at id="${botOpenId}"></at>`,
            name: "金融机器人",
            id: { open_id: "", user_id: "" },
          },
        ],
      },
      sender: { sender_id: { open_id: "ou_user_1", user_id: "u_1" } },
    });

    const ctx = parseFeishuMessageEvent(event, botOpenId);
    expect(ctx.mentionedBot).toBe(true);
  });
});

