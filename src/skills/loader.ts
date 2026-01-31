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

    const skills: DynamicSkill[] = [];

    // Helper to process a directory and see if it is a skill
    const tryLoadSkill = (dirPath: string, id: string): DynamicSkill | null => {
        const metadataPath = path.join(dirPath, "SKILL.md");
        const indexPath = path.join(dirPath, "index.ts");
        const hasMeta = fs.existsSync(metadataPath);
        const hasIndex = fs.existsSync(indexPath);

        if (!hasMeta && !hasIndex) return null;

        const skill: DynamicSkill = {
            id,
            rootDir: dirPath,
            tools: [],
        };
        if (hasMeta) skill.metadataPath = metadataPath;
        if (hasIndex) {
            skill.indexPath = indexPath;
            try {
                const mod = jiti(indexPath);
                const tools = resolveToolSpecs(mod);
                skill.tools.push(...tools);
            } catch (err) {
                console.error(`[skills] Failed to load ${indexPath}:`, err);
            }
        }
        return skill;
    };

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (["utils", "common", "types", "node_modules"].includes(entry.name)) continue;

        const rootPath = path.join(skillsDir, entry.name);

        // 1. Check if the directory itself is a skill
        const directSkill = tryLoadSkill(rootPath, entry.name);
        if (directSkill) {
            skills.push(directSkill);
            continue; // strict: if it's a skill, don't look inside for more skills
        }

        // 2. Explore one level deeper (for category/username folders)
        try {
            const subEntries = fs.readdirSync(rootPath, { withFileTypes: true });
            for (const sub of subEntries) {
                if (!sub.isDirectory()) continue;
                const subPath = path.join(rootPath, sub.name);
                // ID becomes "parent/child" e.g. "0xadamsu/game-light-tracker"
                const nestedSkill = tryLoadSkill(subPath, `${entry.name}/${sub.name}`);
                if (nestedSkill) {
                    skills.push(nestedSkill);
                }
            }
        } catch (err) {
            // ignore access errors
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
