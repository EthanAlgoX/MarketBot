import { render } from "lit";
import { describe, expect, it } from "vitest";

import type { MessageGroup } from "../types/chat-types";
import { renderMessageGroup } from "./grouped-render";

function renderGroup(message: unknown, role = "tool") {
  const container = document.createElement("div");
  const group: MessageGroup = {
    kind: "group",
    key: "group:test",
    role,
    messages: [{ key: "msg:test", message }],
    timestamp: Date.now(),
    isStreaming: false,
  };
  render(
    renderMessageGroup(group, {
      showReasoning: false,
      assistantName: "Assistant",
      assistantAvatar: null,
    }),
    container,
  );
  return container;
}

describe("grouped chat rendering", () => {
  it("renders tool JSON payloads as timeline cards without raw chat bubble", () => {
    const container = renderGroup({
      role: "toolresult",
      toolName: "browser",
      content: JSON.stringify({
        status: "error",
        error: "Can't reach browser control service",
      }),
    });

    expect(container.querySelector(".tool-timeline")).not.toBeNull();
    expect(container.querySelector(".chat-text")).toBeNull();
    expect(container.textContent).toContain("browser");
    expect(container.textContent).toContain("Can't reach browser control service");
  });

  it("still renders assistant markdown bubbles", () => {
    const container = renderGroup(
      { role: "assistant", content: "Hello **world**" },
      "assistant",
    );

    expect(container.querySelector(".chat-text")).not.toBeNull();
    expect(container.querySelector(".chat-text strong")?.textContent).toBe("world");
  });

  it("keeps tool plain-text preview in timeline while hiding raw bubble", () => {
    const container = renderGroup({
      role: "toolresult",
      toolName: "web_search",
      content: "Fetched 5 sources successfully",
    });

    expect(container.querySelector(".tool-timeline")).not.toBeNull();
    expect(container.querySelector(".chat-text")).toBeNull();
    expect(container.textContent).toContain("Fetched 5 sources successfully");
  });
});
