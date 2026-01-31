export interface ToolContext {
  rawArgs: string;
  args: string[];
  json?: unknown;
  cwd: string;
  env: NodeJS.ProcessEnv;
  agentId?: string;
}

export interface ToolResult {
  ok: boolean;
  output: string;
  data?: unknown;
}

export interface ToolSpec {
  name: string;
  description?: string;
  version?: string;
  tags?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  examples?: Array<{
    description?: string;
    input: string;
    output?: string;
  }>;
  timeoutMs?: number;
  run: (context: ToolContext) => Promise<ToolResult>;
}
