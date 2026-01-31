import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import type { ToolSpec } from "../tools/types.js";

const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs"],
});

export interface DynamicSkill {
    id: string;
    rootDir: string;
    metadataPath?: string;
    indexPath?: string;
    tools: ToolSpec[];
}

export async function discoverSkills(skillsDir: string): Promise<DynamicSkill[]> {
    if (!fs.existsSync(skillsDir)) return [];

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    const skills: DynamicSkill[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillId = entry.name;
        const skillRoot = path.join(skillsDir, skillId);
        const metadataPath = path.join(skillRoot, "SKILL.md");
        const indexPath = path.join(skillRoot, "index.ts");

        const skill: DynamicSkill = {
            id: skillId,
            rootDir: skillRoot,
            tools: [],
        };

        if (fs.existsSync(metadataPath)) {
            skill.metadataPath = metadataPath;
        }

        if (fs.existsSync(indexPath)) {
            skill.indexPath = indexPath;
            try {
                const mod = jiti(indexPath);
                // We expect index.ts to export a list of tools or a single tool spec
                const tools = resolveToolSpecs(mod);
                skill.tools.push(...tools);
            } catch (err) {
                console.error(`[skills] Failed to load ${indexPath}:`, err);
            }
        }

        if (skill.metadataPath || skill.indexPath) {
            skills.push(skill);
        }
    }

    return skills;
}

function resolveToolSpecs(mod: any): ToolSpec[] {
    const exported = mod.default || mod;

    if (Array.isArray(exported)) {
        return exported.filter(isToolSpec);
    }

    if (isToolSpec(exported)) {
        return [exported];
    }

    // Check for common patterns like export { toolA, toolB }
    const specs: ToolSpec[] = [];
    for (const key of Object.keys(mod)) {
        if (isToolSpec(mod[key])) {
            specs.push(mod[key]);
        }
    }

    return specs;
}

function isToolSpec(obj: any): obj is ToolSpec {
    return obj && typeof obj === "object" && typeof obj.name === "string" && typeof obj.run === "function";
}
