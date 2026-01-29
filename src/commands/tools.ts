import { buildToolContext } from "../tools/context.js";
import { createDefaultToolRegistry } from "../tools/registry.js";

export async function toolsListCommand(opts: { json?: boolean } = {}): Promise<void> {
  const registry = createDefaultToolRegistry();
  const tools = registry.list();
  if (opts.json) {
    console.log(JSON.stringify({ tools: tools.map((tool) => ({ name: tool.name, description: tool.description })) }, null, 2));
    return;
  }
  if (tools.length === 0) {
    console.log("No tools registered.");
    return;
  }
  for (const tool of tools) {
    const description = tool.description ? ` - ${tool.description}` : "";
    console.log(`${tool.name}${description}`);
  }
}

export async function toolsInfoCommand(opts: { name: string; json?: boolean } ): Promise<void> {
  const registry = createDefaultToolRegistry();
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

  if (opts.json) {
    console.log(JSON.stringify({ name: tool.name, description: tool.description }, null, 2));
    return;
  }

  console.log(`${tool.name}`);
  if (tool.description) console.log(tool.description);
}

export async function toolsRunCommand(opts: { name: string; args: string[]; json?: boolean }): Promise<void> {
  const registry = createDefaultToolRegistry();
  const tool = registry.get(opts.name);
  if (!tool) {
    throw new Error(`Tool not found: ${opts.name}`);
  }

  const context = buildToolContext(opts.args.join(" "));
  const result = await tool.run(context);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(result.output);
}
