import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULTS_DIR = path.resolve(__dirname, "../config/defaults");

function loadDefault(filename: string, fallback: string): string {
    try {
        return fs.readFileSync(path.join(DEFAULTS_DIR, filename), "utf-8");
    } catch (err) {
        console.warn(`[Config] Failed to load default ${filename}, using fallback.`);
        return fallback;
    }
}

export const DEFAULT_AGENTS_CONTENT = loadDefault("AGENTS.md", `# AGENTS.md\n\nYou are MarketBot.`);
export const DEFAULT_SOUL_CONTENT = loadDefault("SOUL.md", `# SOUL.md\n\nTone: professional.`);
export const DEFAULT_TOOLS_CONTENT = loadDefault("TOOLS.md", `# TOOLS.md\n\nUse tools.`);
export const DEFAULT_IDENTITY_CONTENT = loadDefault("IDENTITY.md", `# IDENTITY.md\n\nName: MarketBot`);
export const DEFAULT_USER_CONTENT = loadDefault("USER.md", `# USER.md\n\nUser: Analyst`);
export const DEFAULT_BOOTSTRAP_CONTENT = loadDefault("BOOTSTRAP.md", `# BOOTSTRAP.md\n\nStore context here.`);
