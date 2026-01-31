import { buildToolContext } from "../tools/context.js";
import { createDefaultToolRegistry } from "../tools/registry.js";
import { loadConfig } from "../config/io.js";
import { isToolAllowed, resolveToolAllowlist, resolveToolPolicy } from "../tools/policy.js";

export async function toolsListCommand(opts: { json?: boolean; agentId?: string } = {}): Promise<void> {
  const registry = createDefaultToolRegistry();
  const config = await loadConfig();
  const allTools = registry.list();
  const policy = resolveToolPolicy(config, opts.agentId);
  const allowed = filterAllowedTools(allTools, policy);

  if (opts.json) {
    console.log(
      JSON.stringify(
        { tools: allowed.map((tool) => ({ name: tool.name, description: tool.description })) },
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
    console.log(`${tool.name}${description}`);
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
    console.log(JSON.stringify({ name: tool.name, description: tool.description }, null, 2));
    return;
  }

  console.log(`${tool.name}`);
  if (tool.description) console.log(tool.description);
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

  const context = buildToolContext(opts.args.join(" "));
  const result = await tool.run(context);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(result.output);
}

function filterAllowedTools(
  tools: Array<{ name: string; description?: string }>,
  policy: Parameters<typeof resolveToolAllowlist>[0],
) {
  const allowlist = resolveToolAllowlist(policy, tools.map((tool) => tool.name));
  const allowed = new Set(allowlist.map((name) => name.toLowerCase()));
  return tools.filter((tool) => allowed.has(tool.name.toLowerCase()));
}
