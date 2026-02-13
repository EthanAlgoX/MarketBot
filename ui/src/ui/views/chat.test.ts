import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import type { SessionsListResult } from "../types";
import { renderChat, type ChatProps } from "./chat";

function createSessions(): SessionsListResult {
  return {
    ts: 0,
    path: "",
    count: 0,
    defaults: { model: null, contextTokens: null },
    sessions: [],
  };
}

function createProps(overrides: Partial<ChatProps> = {}): ChatProps {
  return {
    sessionKey: "main",
    onSessionKeyChange: () => undefined,
    thinkingLevel: null,
    showThinking: false,
    loading: false,
    sending: false,
    canAbort: false,
    compactionStatus: null,
    messages: [],
    toolMessages: [],
    stream: null,
    streamStartedAt: null,
    assistantAvatarUrl: null,
    draft: "",
    queue: [],
    connected: true,
    canSend: true,
    disabledReason: null,
    error: null,
    sessions: createSessions(),
    focusMode: false,
    assistantName: "MarketBot",
    assistantAvatar: null,
    onRefresh: () => undefined,
    onToggleFocusMode: () => undefined,
    onDraftChange: () => undefined,
    onSend: () => undefined,
    onQueueRemove: () => undefined,
    onNewSession: () => undefined,
    ...overrides,
  };
}

describe("chat view", () => {
  it("shows a stop button when aborting is available", () => {
    const container = document.createElement("div");
    const onAbort = vi.fn();
    render(
      renderChat(
        createProps({
          canAbort: true,
          onAbort,
        }),
      ),
      container,
    );

    const stopButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Stop",
    );
    expect(stopButton).not.toBeUndefined();
    stopButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("New session");
  });

  it("shows a new session button when aborting is unavailable", () => {
    const container = document.createElement("div");
    const onNewSession = vi.fn();
    render(
      renderChat(
        createProps({
          canAbort: false,
          onNewSession,
        }),
      ),
      container,
    );

    const newSessionButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "New session",
    );
    expect(newSessionButton).not.toBeUndefined();
    newSessionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onNewSession).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Stop");
  });

  it("hides internal /new bootstrap prompt from history", () => {
    const container = document.createElement("div");
    render(
      renderChat(
        createProps({
          messages: [
            {
              role: "user",
              content: [
                "[System: Reply in English.]",
                "",
                "A new session was started via /new or /reset. Say hi briefly (1-2 sentences) and ask what the user wants to do next.",
                "If the runtime model differs from default_model in the system prompt, mention the default model in the greeting.",
                "Do not mention internal steps, files, tools, or reasoning.",
              ].join("\n"),
              timestamp: Date.now() - 1000,
            },
            {
              role: "assistant",
              content: "Hi there! What would you like to work on today?",
              timestamp: Date.now(),
            },
          ],
        }),
      ),
      container,
    );

    expect(container.textContent).not.toContain("[System: Reply in English.]");
    expect(container.textContent).not.toContain(
      "A new session was started via /new or /reset.",
    );
    expect(container.textContent).toContain(
      "Hi there! What would you like to work on today?",
    );
  });

  it("hides assistant process messages that contain tool activity", () => {
    const container = document.createElement("div");
    render(
      renderChat(
        createProps({
          messages: [
            {
              role: "user",
              content: "请给我今天的全球股市新闻",
              timestamp: Date.now() - 3000,
            },
            {
              role: "assistant",
              content: [
                {
                  type: "text",
                  text: "让我尝试使用财经工具获取主要指数的市场数据，然后基于此提供分析：",
                },
                {
                  type: "tool-call",
                  name: "finance",
                  arguments: { symbol: "SPY" },
                },
              ],
              timestamp: Date.now() - 2000,
            },
            {
              role: "assistant",
              content: "这是今天的市场摘要：美股三大指数震荡，能源板块相对强势。",
              timestamp: Date.now() - 1000,
            },
          ],
        }),
      ),
      container,
    );

    expect(container.textContent).not.toContain("让我尝试使用财经工具");
    expect(container.textContent).toContain("这是今天的市场摘要");
  });
});
