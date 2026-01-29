import type { ToolSpec } from "./types.js";
import { createBuiltinTools } from "./tools.js";

export class ToolRegistry {
  private tools = new Map<string, ToolSpec>();

  register(tool: ToolSpec) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolSpec | undefined {
    return this.tools.get(name);
  }

  list(): ToolSpec[] {
    return Array.from(this.tools.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of createBuiltinTools()) {
    registry.register(tool);
  }
  return registry;
}
