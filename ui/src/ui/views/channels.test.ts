import { render } from "lit";
import { describe, expect, it } from "vitest";

import type { ChannelsStatusSnapshot } from "../types";
import { renderChannels } from "./channels";
import type { ChannelsProps } from "./channels.types";

function createSnapshot(
  overrides: Partial<ChannelsStatusSnapshot> = {},
): ChannelsStatusSnapshot {
  return {
    ts: Date.now(),
    channelOrder: ["discord"],
    channelLabels: { discord: "Discord" },
    channels: {
      discord: {
        configured: false,
        running: false,
      },
    },
    channelAccounts: { discord: [] },
    channelDefaultAccountId: {},
    ...overrides,
  };
}

function createProps(overrides: Partial<ChannelsProps> = {}): ChannelsProps {
  return {
    language: "en",
    connected: true,
    loading: false,
    snapshot: null,
    lastError: null,
    lastSuccessAt: null,
    whatsappMessage: null,
    whatsappQrDataUrl: null,
    whatsappConnected: null,
    whatsappBusy: false,
    configSchema: null,
    configSchemaLoading: false,
    configForm: {},
    configUiHints: {},
    configSaving: false,
    configFormDirty: false,
    nostrProfileFormState: null,
    nostrProfileAccountId: null,
    onRefresh: () => undefined,
    onWhatsAppStart: () => undefined,
    onWhatsAppWait: () => undefined,
    onWhatsAppLogout: () => undefined,
    onConfigPatch: () => undefined,
    onConfigSave: () => undefined,
    onConfigReload: () => undefined,
    onNostrProfileEdit: () => undefined,
    onNostrProfileCancel: () => undefined,
    onNostrProfileFieldChange: () => undefined,
    onNostrProfileSave: () => undefined,
    onNostrProfileImport: () => undefined,
    onNostrProfileToggleAdvanced: () => undefined,
    ...overrides,
  };
}

describe("channels view", () => {
  it("shows Google Chat snapshot values", () => {
    const container = document.createElement("div");
    const now = Date.now();
    render(
      renderChannels(
        createProps({
          snapshot: createSnapshot({
            channelOrder: ["googlechat"],
            channelLabels: { googlechat: "Google Chat" },
            channels: {
              googlechat: {
                configured: true,
                running: true,
                credentialSource: "service-account",
                audienceType: "space",
                audience: "team-room",
                lastStartAt: now - 1_000,
                lastProbeAt: now - 500,
              },
            },
            channelAccounts: { googlechat: [] },
          }),
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Google Chat");
    expect(container.textContent).toContain("service-account");
    expect(container.textContent).toContain("space · team-room");
  });

  it("renders health card classes and no-snapshot fallback", () => {
    const container = document.createElement("div");
    render(
      renderChannels(
        createProps({
          snapshot: null,
          lastError: "gateway disconnected",
        }),
      ),
      container,
    );

    expect(container.querySelector(".channels-health")).toBeTruthy();
    expect(container.querySelector(".channels-health__snapshot")).toBeTruthy();
    expect(container.querySelector(".channel-callout")?.textContent).toContain(
      "gateway disconnected",
    );
    expect(container.textContent).toContain("No snapshot yet.");
  });

  it("orders active channels before inactive channels", () => {
    const container = document.createElement("div");
    const now = Date.now();
    render(
      renderChannels(
        createProps({
          snapshot: createSnapshot({
            channelOrder: ["slack", "discord"],
            channelLabels: { slack: "Slack", discord: "Discord" },
            channels: {
              slack: {
                configured: false,
                running: false,
                connected: false,
              },
              discord: {
                configured: true,
                running: true,
                lastStartAt: now - 1_000,
                lastProbeAt: now - 500,
              },
            },
            channelAccounts: {
              slack: [],
              discord: [],
            },
          }),
        }),
      ),
      container,
    );

    const titles = Array.from(
      container.querySelectorAll(".channels-grid .card-title"),
    ).map((el) => el.textContent?.trim());

    expect(titles[0]).toBe("Discord");
    expect(titles[1]).toBe("Slack");
  });

  it("keeps baseline plugin channels visible when snapshot is sparse", () => {
    const container = document.createElement("div");
    render(
      renderChannels(
        createProps({
          snapshot: createSnapshot({
            channelOrder: ["discord"],
            channelLabels: { discord: "Discord" },
            channels: {
              discord: {
                configured: true,
                running: true,
              },
            },
            channelAccounts: { discord: [] },
          }),
        }),
      ),
      container,
    );

    const titles = Array.from(
      container.querySelectorAll(".channels-grid .card-title"),
    ).map((el) => el.textContent?.trim());

    expect(titles).toContain("Feishu");
    expect(titles).toContain("DingTalk");
  });

  it("shows localized baseline plugin channel labels in Chinese mode", () => {
    const container = document.createElement("div");
    render(
      renderChannels(
        createProps({
          language: "zh",
          snapshot: createSnapshot({
            channelOrder: ["discord"],
            channelLabels: { discord: "Discord" },
            channels: {
              discord: {
                configured: true,
                running: true,
              },
            },
            channelAccounts: { discord: [] },
          }),
        }),
      ),
      container,
    );

    const titles = Array.from(
      container.querySelectorAll(".channels-grid .card-title"),
    ).map((el) => el.textContent?.trim());

    expect(titles).toContain("飞书");
    expect(titles).toContain("钉钉");
  });
});
