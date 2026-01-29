import { loadConfig } from "../config/io.js";
import { resolveDefaultAgentId } from "../agents/agentScope.js";
import { loadSkills } from "../skills/registry.js";

export async function skillsListCommand(opts: { json?: boolean; agentId?: string } = {}): Promise<void> {
  const config = await loadConfig();
  const agentId = opts.agentId ?? resolveDefaultAgentId(config);
  const skills = await loadSkills(config, agentId);

  if (opts.json) {
    console.log(JSON.stringify({ skills }, null, 2));
    return;
  }

  if (skills.length === 0) {
    console.log("No skills found.");
    return;
  }

  for (const skill of skills) {
    const description = skill.description ? ` - ${skill.description}` : "";
    console.log(`${skill.name}${description}`);
    console.log(`  ${skill.location}`);
  }
}
