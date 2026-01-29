export interface ToolContext {
  rawArgs: string;
  args: string[];
  json?: unknown;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface ToolResult {
  ok: boolean;
  output: string;
  data?: unknown;
}

export interface ToolSpec {
  name: string;
  description?: string;
  run: (context: ToolContext) => Promise<ToolResult>;
}
