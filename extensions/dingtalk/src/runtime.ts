import type { PluginRuntime } from "marketbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setDingTalkRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getDingTalkRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("DingTalk runtime not set (plugin register() not called yet)");
  }
  return runtime;
}

