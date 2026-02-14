import { render } from "lit";
import { describe, expect, it } from "vitest";

import type { UiSettings } from "../storage";
import { renderOverview, type OverviewProps } from "./overview";

function createSettings(overrides: Partial<UiSettings> = {}): UiSettings {
  return {
    gatewayUrl: "ws://127.0.0.1:18789",
    token: "",
    sessionKey: "main",
    lastActiveSessionKey: "main",
    theme: "system",
    language: "en",
    chatFocusMode: false,
    chatShowThinking: true,
    splitRatio: 0.6,
    navCollapsed: false,
    navGroupsCollapsed: {},
    stocksPreferences: {
      timeframe: "6mo",
      reportType: "simple",
      includeFundamentals: false,
      newsLimit: "2",
      locale: "US",
    },
    ...overrides,
  };
}

function createProps(overrides: Partial<OverviewProps> = {}): OverviewProps {
  return {
    language: "en",
    connected: false,
    settings: createSettings(),
    password: "",
    lastError: null,
    onSettingsChange: () => undefined,
    onPasswordChange: () => undefined,
    onSessionKeyChange: () => undefined,
    onConnect: () => undefined,
    onRefresh: () => undefined,
    ...overrides,
  };
}

describe("overview view", () => {
  it("renders connection layout classes", () => {
    const container = document.createElement("div");
    render(renderOverview(createProps()), container);

    expect(container.querySelector(".connection-card")).not.toBeNull();
    expect(container.querySelector(".connection-head")).not.toBeNull();
    expect(container.querySelector(".connection-form-grid")).not.toBeNull();
    expect(container.querySelector(".connection-share")).not.toBeNull();
  });

  it("shows auth-required hint for unauthorized error without credentials", () => {
    const container = document.createElement("div");
    render(
      renderOverview(
        createProps({
          lastError: "connect failed: unauthorized",
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("This gateway requires auth.");
    expect(container.querySelector(".connection-hint-links")).not.toBeNull();
  });
});
