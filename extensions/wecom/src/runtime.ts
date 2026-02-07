import type { PluginRuntime } from "marketbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setWecomRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getWecomRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("WeCom runtime not set (plugin register() not called yet)");
  }
  return runtime;
}

