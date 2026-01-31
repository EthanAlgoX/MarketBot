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
    watch?: boolean;
    watchDebounceMs?: number;
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
  tools?: {
    allow?: string[];
    alsoAllow?: string[];
    deny?: string[];
    profile?: "minimal" | "analysis" | "full";
  };
  sessions?: {
    enabled?: boolean;
    dir?: string;
    maxEntries?: number;
    maxEntryChars?: number;
    contextMaxChars?: number;
    includeContext?: boolean;
  };
  server?: {
    host?: string;
    port?: number;
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
  web?: {
    search?: {
      enabled?: boolean;
      provider?: "perplexity" | "browser";
      apiKey?: string;
      apiKeyEnv?: string;
      maxResults?: number;
      headless?: boolean;
    };
    fetch?: {
      enabled?: boolean;
      maxChars?: number;
      timeoutSeconds?: number;
    };
  };
  notification?: {
    wechat?: { webhookUrl?: string };
    feishu?: { webhookUrl?: string };
    telegram?: { botToken?: string; chatId?: string };
    webhook?: { url?: string; bearerToken?: string };
  };
}
