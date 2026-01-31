import path from "node:path";
import type { ToolSpec } from "./types.js";
import { discoverSkills } from "../skills/loader.js";

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

  async loadDynamicTools(cwd: string = process.cwd()) {
    const skillsDir = path.join(cwd, "src", "skills");
    const skills = await discoverSkills(skillsDir);
    for (const skill of skills) {
      for (const tool of skill.tools) {
        this.register(tool);
      }
    }
  }
}

export async function createDefaultToolRegistry(): Promise<ToolRegistry> {
  const registry = new ToolRegistry();
  await registry.loadDynamicTools();
  return registry;
}
