import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MarketBotApp } from "./app";

const originalConnect = MarketBotApp.prototype.connect;

function mountApp(pathname: string) {
  window.history.replaceState({}, "", pathname);
  const app = document.createElement("marketbot-app") as MarketBotApp;
  document.body.append(app);
  return app;
}

beforeEach(() => {
  MarketBotApp.prototype.connect = () => {
    // no-op: avoid real gateway WS connections in browser tests
  };
  window.__MARKETBOT_CONTROL_UI_BASE_PATH__ = undefined;
  localStorage.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  MarketBotApp.prototype.connect = originalConnect;
  window.__MARKETBOT_CONTROL_UI_BASE_PATH__ = undefined;
  localStorage.clear();
  document.body.innerHTML = "";
});

describe("chat markdown rendering", () => {
  it("renders markdown inside tool output sidebar", async () => {
    const app = mountApp("/chat");
    await app.updateComplete;

    const timestamp = Date.now();
    app.chatMessages = [
      {
        role: "assistant",
        content: [
          { type: "toolcall", name: "noop", arguments: {} },
          { type: "toolresult", name: "noop", text: "Hello **world**" },
        ],
        timestamp,
      },
    ];

    await app.updateComplete;

    const toolSteps = Array.from(
      app.querySelectorAll<HTMLElement>(".tool-step"),
    );
    const toolStep = toolSteps.find((el) =>
      el.classList.contains("tool-step--clickable") || el.classList.contains("tool-step--done"),
    );
    expect(toolStep).not.toBeUndefined();
    toolStep?.click();

    await app.updateComplete;

    const strong = app.querySelector(".sidebar-markdown strong");
    expect(strong?.textContent).toBe("world");
  });
});
