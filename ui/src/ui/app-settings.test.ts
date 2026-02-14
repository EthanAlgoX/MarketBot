import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Tab } from "./navigation";
import { applySettingsFromUrl, setTabFromRoute } from "./app-settings";

type SettingsHost = Parameters<typeof setTabFromRoute>[0] & {
  logsPollInterval: number | null;
  configActiveSection: string | null;
  configActiveSubsection: string | null;
};

const createHost = (tab: Tab): SettingsHost => ({
  settings: {
    gatewayUrl: "",
    token: "",
    sessionKey: "main",
    lastActiveSessionKey: "main",
    theme: "system",
    chatFocusMode: false,
    chatShowThinking: true,
    splitRatio: 0.6,
    navCollapsed: false,
    navGroupsCollapsed: {},
  },
  theme: "system",
  themeResolved: "dark",
  applySessionKey: "main",
  sessionKey: "main",
  tab,
  connected: false,
  chatHasAutoScrolled: false,
  logsAtBottom: false,
  eventLog: [],
  eventLogBuffer: [],
  basePath: "",
  themeMedia: null,
  themeMediaHandler: null,
  logsPollInterval: null,
  configActiveSection: null,
  configActiveSubsection: null,
});

describe("setTabFromRoute", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts and stops log polling based on the tab", () => {
    const host = createHost("chat");

    setTabFromRoute(host, "logs");
    expect(host.logsPollInterval).not.toBeNull();

    setTabFromRoute(host, "chat");
    expect(host.logsPollInterval).toBeNull();
  });
});

describe("applySettingsFromUrl", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("reads config section and subsection from URL query", () => {
    const host = createHost("config");
    window.history.replaceState(
      {},
      "",
      "/config?section=gateway&subsection=mode",
    );

    applySettingsFromUrl(host);

    expect(host.configActiveSection).toBe("gateway");
    expect(host.configActiveSubsection).toBe("mode");
  });

  it("clears subsection when section is empty", () => {
    const host = createHost("config");
    host.configActiveSubsection = "legacy";
    window.history.replaceState(
      {},
      "",
      "/config?section=&subsection=mode",
    );

    applySettingsFromUrl(host);

    expect(host.configActiveSection).toBeNull();
    expect(host.configActiveSubsection).toBeNull();
  });
});
