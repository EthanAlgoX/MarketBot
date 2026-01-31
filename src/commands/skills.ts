import { loadConfig } from "../config/io.js";
import { resolveDefaultAgentId } from "../agents/agentScope.js";
import { buildSkillStatus } from "../skills/status.js";
import { formatSkillInfo, formatSkillsCheck, formatSkillsList } from "../cli/skills-format.js";
import { installSkill, removeSkill } from "../skills/installer.js";
import { syncSkillsToWorkspace } from "../skills/sync.js";
import { runSkillCommand } from "../skills/invocation.js";
import { createDefaultToolRegistry } from "../tools/registry.js";

export async function skillsListCommand(opts: { json?: boolean; agentId?: string } = {}): Promise<void> {
  const config = await loadConfig();
  const agentId = opts.agentId ?? resolveDefaultAgentId(config);
  const report = await buildSkillStatus(config, { agentId });
  console.log(formatSkillsList(report, { json: opts.json }));
}

export async function skillsCheckCommand(opts: {
  json?: boolean;
  eligible?: boolean;
  verbose?: boolean;
  agentId?: string;
} = {}): Promise<void> {
  const config = await loadConfig();
  const agentId = opts.agentId ?? resolveDefaultAgentId(config);
  const report = await buildSkillStatus(config, { agentId });
  console.log(formatSkillsCheck(report, {
    json: opts.json,
    eligible: opts.eligible,
    verbose: opts.verbose,
  }));
}

export async function skillsInstallCommand(opts: {
  source: string;
  name?: string;
  scope?: "managed" | "workspace";
  agentId?: string;
  force?: boolean;
}): Promise<void> {
  const config = await loadConfig();
  const installed = await installSkill(config, {
    source: opts.source,
    name: opts.name,
    scope: opts.scope,
    agentId: opts.agentId,
    force: opts.force,
  });
  console.log(`Installed skills: ${installed.join(", ")}`);
}

export async function skillsInfoCommand(opts: {
  name: string;
  json?: boolean;
  agentId?: string;
}): Promise<void> {
  const config = await loadConfig();
  const agentId = opts.agentId ?? resolveDefaultAgentId(config);
  const report = await buildSkillStatus(config, { agentId });
  console.log(formatSkillInfo(report, opts.name, { json: opts.json }));
}

export async function skillsRemoveCommand(opts: {
  name: string;
  scope?: "managed" | "workspace";
  agentId?: string;
}): Promise<void> {
  const config = await loadConfig();
  const dir = await removeSkill(config, {
    name: opts.name,
    scope: opts.scope,
    agentId: opts.agentId,
  });
  console.log(`Removed skill at ${dir}`);
}

export async function skillsSyncCommand(opts: {
  agentId?: string;
  removeExtra?: boolean;
}): Promise<void> {
  const config = await loadConfig();
  const result = await syncSkillsToWorkspace(config, {
    agentId: opts.agentId,
    removeExtra: opts.removeExtra,
  });
  console.log(`Copied: ${result.copied.join(", ") || "none"}`);
  if (opts.removeExtra) {
    console.log(`Removed: ${result.removed.join(", ") || "none"}`);
  }
}

export async function skillsRunCommand(opts: {
  skill: string;
  command: string;
  args: string[];
  agentId?: string;
  json?: boolean;
}): Promise<void> {
  const config = await loadConfig();
  const registry = createDefaultToolRegistry();
  const result = await runSkillCommand(config, {
    skill: opts.skill,
    command: opts.command,
    rawArgs: opts.args.join(" "),
    agentId: opts.agentId,
    registry,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(result.output);
}
