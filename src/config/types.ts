export interface TradeBotConfig {
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
  };
}
