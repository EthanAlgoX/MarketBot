import type { PluginRuntime } from "marketbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setQQBotRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getQQBotRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("QQBot runtime not set (plugin register() not called yet)");
  }
  return runtime;
}

