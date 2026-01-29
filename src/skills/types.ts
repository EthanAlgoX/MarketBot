export interface SkillInvocationPolicy {
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
}

export interface SkillCommandDispatchSpec {
  kind: "tool";
  toolName: string;
  argMode?: "raw";
}

export interface SkillCommandSpec {
  name: string;
  description?: string;
  dispatch?: SkillCommandDispatchSpec;
}

export interface SkillInstallSpec {
  id?: string;
  kind: "brew" | "node" | "go" | "uv" | "download" | "apt" | "pip" | "other";
  label?: string;
  bins?: string[];
  os?: string[];
  formula?: string;
  package?: string;
  module?: string;
  url?: string;
}
