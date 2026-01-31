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
      baseUrl?: string;
      model?: string;
      maxResults?: number;
      timeoutSeconds?: number;
      cacheTtlMinutes?: number;
      headless?: boolean;
    };
    fetch?: {
      enabled?: boolean;
      maxChars?: number;
      maxRedirects?: number;
      timeoutSeconds?: number;
      cacheTtlMinutes?: number;
      userAgent?: string;
    };
  };

  notification?: {
    wechat?: {
      webhookUrl?: string;
    };
    feishu?: {
      webhookUrl?: string;
    };
    telegram?: {
      botToken?: string;
      chatId?: string;
    };
    webhook?: {
      url?: string;
      bearerToken?: string;
    };
  };
}

