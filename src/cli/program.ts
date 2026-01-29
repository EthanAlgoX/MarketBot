import { Command } from "commander";
import { analyzeCommand } from "../commands/analyze.js";
import { configShowCommand, configValidateCommand } from "../commands/config.js";
import { agentsAddCommand, agentsListCommand } from "../commands/agents.js";
import {
  skillsInfoCommand,
  skillsInstallCommand,
  skillsListCommand,
  skillsRemoveCommand,
  skillsSyncCommand,
  skillsRunCommand,
} from "../commands/skills.js";
import { toolsInfoCommand, toolsListCommand, toolsRunCommand } from "../commands/tools.js";
import { setupCommand } from "../commands/setup.js";
import { createDefaultDeps } from "./deps.js";

export function buildProgram() {
  const program = new Command();

  program
    .name("marketbot")
    .description("MarketBot - multi-agent trading analysis CLI")
    .version("0.1.0");

  program
    .command("analyze [query]")
    .description("Run a market analysis based on the user query")
    .option("--json", "Output JSON instead of the report", false)
    .option("--live", "Use live data providers", false)
    .option("--mock", "Force mock data", false)
    .option("--mode <mode>", "Data mode: mock | auto | api | scrape")
    .option("--search", "Enable web search + scrape fallback", false)
    .option("--scrape", "Force scrape mode + enable web search", false)
    .option("--agent <id>", "Agent id (maps to workspace)")
    .action(async (query: string | undefined, opts) => {
      const deps = createDefaultDeps();
      await analyzeCommand(
        {
          query,
          json: Boolean(opts.json),
          live: Boolean(opts.live),
          mock: Boolean(opts.mock),
          mode: opts.mode,
          search: Boolean(opts.search),
          scrape: Boolean(opts.scrape),
          agentId: opts.agent,
        },
        deps,
      );
    });

  program
    .command("setup")
    .description("Initialize MarketBot workspace and config")
    .action(async () => {
      await setupCommand();
    });

  const agents = program
    .command("agents")
    .description("Manage MarketBot agents/workspaces");

  agents
    .command("list")
    .description("List configured agents")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await agentsListCommand({ json: Boolean(opts.json) });
    });

  agents
    .command("add <id>")
    .description("Add a new agent")
    .option("--name <name>", "Agent display name")
    .option("--workspace <path>", "Workspace directory for this agent")
    .option("--default", "Make this agent the default", false)
    .option("--json", "Output JSON", false)
    .action(async (id: string, opts) => {
      await agentsAddCommand({
        id,
        name: opts.name,
        workspace: opts.workspace,
        makeDefault: Boolean(opts.default),
        json: Boolean(opts.json),
      });
    });

  const config = program
    .command("config")
    .description("Manage marketbot.json");

  config
    .command("show")
    .description("Print the current config")
    .action(async () => {
      await configShowCommand();
    });

  config
    .command("validate")
    .description("Validate marketbot.json")
    .action(async () => {
      await configValidateCommand();
    });

  const skills = program
    .command("skills")
    .description("Manage skills");

  skills
    .command("list")
    .description("List available skills")
    .option("--json", "Output JSON", false)
    .option("--agent <id>", "Agent id (maps to workspace)")
    .action(async (opts) => {
      await skillsListCommand({ json: Boolean(opts.json), agentId: opts.agent });
    });

  skills
    .command("info <name>")
    .description("Show details about a skill")
    .option("--json", "Output JSON", false)
    .option("--agent <id>", "Agent id (maps to workspace)")
    .action(async (name: string, opts) => {
      await skillsInfoCommand({
        name,
        json: Boolean(opts.json),
        agentId: opts.agent,
      });
    });

  skills
    .command("install <source>")
    .description("Install skills from a local directory or git URL")
    .option("--name <name>", "Override the skill folder name")
    .option("--scope <scope>", "managed | workspace", "managed")
    .option("--agent <id>", "Agent id (required for workspace scope)")
    .option("--force", "Overwrite if the skill exists", false)
    .action(async (source: string, opts) => {
      await skillsInstallCommand({
        source,
        name: opts.name,
        scope: opts.scope === "workspace" ? "workspace" : "managed",
        agentId: opts.agent,
        force: Boolean(opts.force),
      });
    });

  skills
    .command("remove <name>")
    .description("Remove a skill")
    .option("--scope <scope>", "managed | workspace", "managed")
    .option("--agent <id>", "Agent id (required for workspace scope)")
    .action(async (name: string, opts) => {
      await skillsRemoveCommand({
        name,
        scope: opts.scope === "workspace" ? "workspace" : "managed",
        agentId: opts.agent,
      });
    });

  skills
    .command("sync")
    .description("Sync managed skills into the workspace")
    .option("--agent <id>", "Agent id (maps to workspace)")
    .option("--remove-extra", "Remove skills not in managed dir", false)
    .action(async (opts) => {
      await skillsSyncCommand({
        agentId: opts.agent,
        removeExtra: Boolean(opts.removeExtra),
      });
    });

  skills
    .command("run <skill> <command> [args...]")
    .description("Run a skill command with a tool dispatch")
    .option("--json", "Output JSON", false)
    .option("--agent <id>", "Agent id (maps to workspace)")
    .action(async (skill: string, command: string, args: string[], opts) => {
      await skillsRunCommand({
        skill,
        command,
        args,
        json: Boolean(opts.json),
        agentId: opts.agent,
      });
    });

  const tools = program
    .command("tools")
    .description("Manage tools");

  tools
    .command("list")
    .description("List available tools")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await toolsListCommand({ json: Boolean(opts.json) });
    });

  tools
    .command("info <name>")
    .description("Show details about a tool")
    .option("--json", "Output JSON", false)
    .action(async (name: string, opts) => {
      await toolsInfoCommand({ name, json: Boolean(opts.json) });
    });

  tools
    .command("run <name> [args...]")
    .description("Run a tool by name")
    .option("--json", "Output JSON", false)
    .action(async (name: string, args: string[], opts) => {
      await toolsRunCommand({ name, args, json: Boolean(opts.json) });
    });

  return program;
}
