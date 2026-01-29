import { Command } from "commander";
import { analyzeCommand } from "../commands/analyze.js";
import { configShowCommand, configValidateCommand } from "../commands/config.js";
import { agentsAddCommand, agentsListCommand } from "../commands/agents.js";
import { skillsListCommand } from "../commands/skills.js";
import { setupCommand } from "../commands/setup.js";
import { createDefaultDeps } from "./deps.js";

export function buildProgram() {
  const program = new Command();

  program
    .name("tradebot")
    .description("TradeBot - multi-agent trading analysis CLI")
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
    .description("Initialize TradeBot workspace and config")
    .action(async () => {
      await setupCommand();
    });

  const agents = program
    .command("agents")
    .description("Manage TradeBot agents/workspaces");

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
    .description("Manage tradebot.json");

  config
    .command("show")
    .description("Print the current config")
    .action(async () => {
      await configShowCommand();
    });

  config
    .command("validate")
    .description("Validate tradebot.json")
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

  return program;
}
