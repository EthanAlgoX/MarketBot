// Data configuration loader

import * as fs from "node:fs";
import * as path from "node:path";

export interface DataConfig {
    defaultMode: "auto" | "api" | "scrape";
    enableSearch: boolean;
    providers: {
        crypto?: {
            apiKey?: string;
            baseUrl?: string;
        };
        stocks?: {
            apiKey?: string;
            baseUrl?: string;
        };
    };
}

const DEFAULT_CONFIG: DataConfig = {
    defaultMode: "auto",
    enableSearch: false,
    providers: {},
};

/**
 * Load data configuration from file or environment.
 */
export function loadDataConfig(cwd: string = process.cwd()): DataConfig {
    const configPath = path.join(cwd, "data.config.json");

    if (fs.existsSync(configPath)) {
        try {
            const content = fs.readFileSync(configPath, "utf-8");
            const parsed = JSON.parse(content) as Partial<DataConfig>;
            return { ...DEFAULT_CONFIG, ...parsed };
        } catch {
            console.warn("Failed to parse data.config.json, using defaults");
        }
    }

    // Check environment variables
    const envConfig: Partial<DataConfig> = {};

    if (process.env.MARKETBOT_DATA_MODE) {
        const mode = process.env.MARKETBOT_DATA_MODE;
        if (mode === "auto" || mode === "api" || mode === "scrape") {
            envConfig.defaultMode = mode;
        }
    }

    if (process.env.CRYPTO_API_KEY) {
        envConfig.providers = {
            ...envConfig.providers,
            crypto: { apiKey: process.env.CRYPTO_API_KEY },
        };
    }

    return { ...DEFAULT_CONFIG, ...envConfig };
}
