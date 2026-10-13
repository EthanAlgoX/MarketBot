import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { nextAutoSpeakAction } from "./auto-speak";

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function textMessage(id: string, text: string) {
  return {
    id,
    role: "bot" as const,
    blocks: [{ kind: "text" as const, text }],
  };
}

describe("nextAutoSpeakAction", () => {
  const base = {
    botId: "bot-1",
    autoSpeak: true,
    focused: true,
    snapshotReady: true,
    lastSpokenBotId: "bot-1",
    lastSpokenMessageId: "msg-1",
    runStatus: "completed" as string | null,
    messages: [textMessage("msg-1", "Earlier."), textMessage("msg-2", "Hello from the bot.")],
  };

  it("seeds the latest reply when opening a bot so history is not spoken", () => {
    expect(
      nextAutoSpeakAction({
        ...base,
        lastSpokenBotId: null,
        lastSpokenMessageId: null,
      }),
    ).toEqual({ action: "seed", messageId: "msg-2" });
  });

  it("waits until the thread snapshot belongs to this bot", () => {
    expect(nextAutoSpeakAction({ ...base, snapshotReady: false })).toEqual({ action: "wait" });
  });

  it("seeds when autoSpeak is off so enabling later does not dump the last reply", () => {
    expect(nextAutoSpeakAction({ ...base, autoSpeak: false })).toEqual({
      action: "seed",
      messageId: "msg-2",
    });
  });

  it("waits while the thread is not focused instead of speaking in the background", () => {
    expect(nextAutoSpeakAction({ ...base, focused: false })).toEqual({ action: "wait" });
  });

  it("waits while a run is still in flight", () => {
    expect(nextAutoSpeakAction({ ...base, runStatus: "running" })).toEqual({ action: "wait" });
    expect(nextAutoSpeakAction({ ...base, runStatus: "queued" })).toEqual({ action: "wait" });
    expect(nextAutoSpeakAction({ ...base, runStatus: "leased" })).toEqual({ action: "wait" });
  });

  it("speaks a finished reply that has not been spoken yet", () => {
    expect(nextAutoSpeakAction(base)).toEqual({
      action: "speak",
      messageId: "msg-2",
      text: "Hello from the bot.",
    });
  });

  it("does not speak the same reply twice", () => {
    expect(nextAutoSpeakAction({ ...base, lastSpokenMessageId: "msg-2" })).toEqual({
      action: "wait",
    });
  });

  it("marks an empty reply spoken without playing it", () => {
    expect(
      nextAutoSpeakAction({
        ...base,
        messages: [textMessage("msg-2", "   ")],
      }),
    ).toEqual({ action: "seed", messageId: "msg-2" });
  });
});

describe("mobile autoSpeak wiring", () => {
  it("exposes Read replies aloud on bot settings and speaks from the thread", () => {
    const settings = readFileSync(resolve(mobileRoot, "app/bot-settings.tsx"), "utf8");
    const thread = readFileSync(resolve(mobileRoot, "app/thread.tsx"), "utf8");
    const api = readFileSync(resolve(mobileRoot, "lib/api.ts"), "utf8");
    expect(api).toContain('"autoSpeak"');
    expect(settings).toContain('t("Read replies aloud")');
    expect(settings).toContain("autoSpeak");
    expect(thread).toContain("nextAutoSpeakAction");
    expect(thread).toContain("speakText(");
  });
});
