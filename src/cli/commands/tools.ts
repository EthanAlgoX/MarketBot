import fs from "node:fs/promises";
import path from "node:path";

import { buildToolContext } from "../../tools/context.js";
import { createDefaultToolRegistry } from "../../tools/registry.js";
import { loadConfig } from "../../config/io.js";
import { isToolAllowed, resolveToolAllowlist, resolveToolPolicy } from "../../tools/policy.js";
import { appendToolLog } from "../../tools/toolLogging.js";
import { resolveAgentWorkspaceDir } from "../../agents/agentScope.js";

export async function toolsListCommand(opts: { json?: boolean; agentId?: string } = {}): Promise<void> {
  const registry = createDefaultToolRegistry();
  const config = await loadConfig();
  const allTools = registry.list();
  const policy = resolveToolPolicy(config, opts.agentId);
  const allowed = filterAllowedTools(allTools, policy);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          tools: allowed.map((tool) => ({
            name: tool.name,
            description: tool.description,
            version: tool.version,
            tags: tool.tags,
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
            examples: tool.examples,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (allowed.length === 0) {
    console.log("No tools allowed by policy.");
    return;
  }
  for (const tool of allowed) {
    const description = tool.description ? ` - ${tool.description}` : "";
    const version = tool.version ? `@${tool.version}` : "";
    console.log(`${tool.name}${version}${description}`);
  }
}

export async function toolsInfoCommand(opts: { name: string; json?: boolean; agentId?: string }): Promise<void> {
  const registry = createDefaultToolRegistry();
  const config = await loadConfig();
  const tool = registry.get(opts.name);
  if (!tool) {
    const message = `Tool not found: ${opts.name}`;
    if (opts.json) {
      console.log(JSON.stringify({ error: message }, null, 2));
      return;
    }
    console.log(message);
    return;
  }

  const allTools = registry.list().map((entry) => entry.name);
  const policy = resolveToolPolicy(config, opts.agentId);
  if (!isToolAllowed(tool.name, policy, allTools)) {
    const message = `Tool not allowed by policy: ${tool.name}`;
    if (opts.json) {
      console.log(JSON.stringify({ error: message }, null, 2));
      return;
    }
    console.log(message);
    return;
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          name: tool.name,
          description: tool.description,
          version: tool.version,
          tags: tool.tags,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          examples: tool.examples,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`${tool.name}${tool.version ? `@${tool.version}` : ""}`);
  if (tool.description) console.log(tool.description);
  if (tool.tags?.length) console.log(`tags: ${tool.tags.join(", ")}`);
}

export async function toolsRunCommand(opts: { name: string; args: string[]; json?: boolean; agentId?: string }): Promise<void> {
  const registry = createDefaultToolRegistry();
  const config = await loadConfig();
  const tool = registry.get(opts.name);
  if (!tool) {
    throw new Error(`Tool not found: ${opts.name}`);
  }

  const allTools = registry.list().map((entry) => entry.name);
  const policy = resolveToolPolicy(config, opts.agentId);
  if (!isToolAllowed(tool.name, policy, allTools)) {
    throw new Error(`Tool not allowed by policy: ${tool.name}`);
  }

  const context = buildToolContext(opts.args.join(" "), process.cwd(), opts.agentId);
  const startedAt = Date.now();
  try {
    const result = await runToolWithTimeout(tool, context);
    await appendToolLog({
      name: tool.name,
      ok: result.ok,
      durationMs: Date.now() - startedAt,
      input: opts.args.join(" "),
      output: result.output,
    }, context);
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(result.output);
  } catch (err) {
    await appendToolLog({
      name: tool.name,
      ok: false,
      durationMs: Date.now() - startedAt,
      input: opts.args.join(" "),
      error: err instanceof Error ? err.message : String(err),
    }, context);
    throw err;
  }

  return;
}

async function runToolWithTimeout(
  tool: { run: (context: any) => Promise<any>; timeoutMs?: number },
  context: ReturnType<typeof buildToolContext>,
): Promise<any> {
  const timeoutMs = (tool as { timeoutMs?: number }).timeoutMs;
  if (!timeoutMs || timeoutMs <= 0) {
    return tool.run(context as any);
  }
  return await Promise.race([
    tool.run(context as any),
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`Tool timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

export async function toolsLogCommand(opts: { limit?: number; json?: boolean; agentId?: string } = {}): Promise<void> {
  const config = await loadConfig(process.cwd(), { validate: true });
  const agentId = opts.agentId ?? "main";
  const workspaceDir = resolveAgentWorkspaceDir(config, agentId, process.cwd());
  const logPath = path.join(workspaceDir, "logs", "tools.log.jsonl");

  let content = "";
  try {
    content = await fs.readFile(logPath, "utf8");
  } catch {
    if (opts.json) {
      console.log(JSON.stringify({ logs: [] }, null, 2));
    } else {
      console.log("No tool logs found.");
    }
    return;
  }

  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  const limit = opts.limit && Number.isFinite(opts.limit) ? Math.max(1, opts.limit) : 20;
  const slice = lines.slice(-limit).map((line) => {
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      return { raw: line };
    }
  });

  if (opts.json) {
    console.log(JSON.stringify({ logs: slice }, null, 2));
    return;
  }

  for (const entry of slice) {
    const ts = typeof entry.ts === "string" ? entry.ts : "";
    const name = typeof entry.name === "string" ? entry.name : "";
    const ok = entry.ok === true ? "ok" : "err";
    const durationMs = typeof entry.durationMs === "number" ? `${entry.durationMs}ms` : "";
    console.log(`${ts} ${name} ${ok} ${durationMs}`.trim());
  }
}

function filterAllowedTools(
  tools: Array<{ name: string; description?: string }>,
  policy: Parameters<typeof resolveToolAllowlist>[0],
) {
  const allowlist = resolveToolAllowlist(policy, tools.map((tool) => tool.name));
  const allowed = new Set(allowlist.map((name) => name.toLowerCase()));
  return tools.filter((tool) => allowed.has(tool.name.toLowerCase()));
}
