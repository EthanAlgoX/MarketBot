export interface MarketBotConfig {
  agents?: {
    defaults?: {
      workspace?: string;
      ensureBootstrap?: boolean;
    };
    list?: Array<{
      id: string;
      name?: string;
      workspace?: string;
      default?: boolean;
    }>;
  };
  skills?: {
    enabled?: boolean;
    directories?: string[];
    maxCharsPerSkill?: number;
    maxSkills?: number;
    managedDir?: string;
    allowlist?: string[];
    denylist?: string[];
    entries?: Record<
      string,
      {
        enabled?: boolean;
        env?: Record<string, string>;
        config?: Record<string, string>;
        apiKey?: string;
      }
    >;
  };
  llm?: {
    provider?: "mock" | "openai-compatible";
    model?: string;
    baseUrl?: string;
    apiKeyEnv?: string;
    apiKey?: string;
    timeoutMs?: number;
    jsonMode?: boolean;
    headers?: Record<string, string>;
  };
}
