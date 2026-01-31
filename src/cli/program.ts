import { Command } from "commander";
import { analyzeCommand } from "./commands/analyze.js";
import { runAgenticAnalysis } from "./commands/analyzeAgentic.js";
import { webAnalyzeCommand } from "./commands/webAnalyze.js";
import { configShowCommand, configValidateCommand } from "./commands/config.js";
import { agentsAddCommand, agentsListCommand } from "./commands/agents.js";
import {
  skillsCheckCommand,
  skillsInfoCommand,
  skillsInstallCommand,
  skillsListCommand,
  skillsRemoveCommand,
  skillsSyncCommand,
  skillsRunCommand,
} from "./commands/skills.js";
import { toolsInfoCommand, toolsListCommand, toolsRunCommand, toolsLogCommand } from "./commands/tools.js";
import { setupCommand } from "./commands/setup.js";
import { serverCommand } from "./commands/server.js";
import { createDefaultDeps } from "./deps.js";
import { guiCommand } from "./commands/gui.js";
import { tuiCommand } from "./commands/tui.js";
import { doctorCommand } from "./commands/doctor.js";
import { createAuthCommand } from "./commands/auth.js";

export function buildProgram() {
  const program = new Command();

  program
    .name("marketbot")
    .description("MarketBot - multi-agent trading analysis CLI")
    .version("0.1.0");

  program.addCommand(createAuthCommand());
  program.addCommand(doctorCommand());

  program
    .command("analyze [query]")
    .description("Run a market analysis based on the user query")
    .option("--json", "Output JSON instead of the report", false)
    .option("--live", "Use live data providers", false)
    .option("--mode <mode>", "Data mode: auto | api | scrape")
    .option("--search", "Enable web search + scrape fallback", false)
    .option("--scrape", "Force scrape mode + enable web search", false)
    .option("--agent <id>", "Agent id (maps to workspace)")
    .option("--session <key>", "Override session key")
    .option("--agentic", "Use agentic mode (LLM decides which tools to call)", false)
    .option("--verbose", "Show detailed execution info", false)
    .action(async (query: string | undefined, opts) => {
      // Agentic mode: LLM autonomously calls tools
      if (opts.agentic) {
        if (!query) {
          console.error("Error: Query is required for agentic mode");
          process.exit(1);
        }
        console.log("\n🤖 MarketBot Agentic Mode\n");
        const result = await runAgenticAnalysis({
          query,
          verbose: Boolean(opts.verbose),
        });

        if (result.error) {
          console.error(`\n❌ Error: ${result.error}`);
        }

        console.log("\n" + "=".repeat(60));
        console.log("📊 ANALYSIS RESULT");
        console.log("=".repeat(60) + "\n");
        console.log(result.response || "(No response generated)");

        if (result.toolCalls.length > 0) {
          console.log("\n" + "-".repeat(40));
          console.log(`📦 Tool Calls: ${result.iterations} iteration(s), ${result.toolCalls.length} tool(s)`);
        }
        return;
      }

      // Standard pipeline mode
      const deps = createDefaultDeps();
      await analyzeCommand(
        {
          query,
          json: Boolean(opts.json),
          live: Boolean(opts.live),
          mode: opts.mode,
          search: Boolean(opts.search),
          scrape: Boolean(opts.scrape),
          agentId: opts.agent,
          sessionKey: opts.session,
        },
        deps,
      );
    });

  program
    .command("web-analyze [query]")
    .description("Search the web and analyze content for market insights")
    .option("--asset <asset>", "Asset symbol to analyze (e.g., BTC, ETH)")
    .option("--json", "Output JSON instead of report", false)
    .action(async (query: string | undefined, opts) => {
      await webAnalyzeCommand({
        query,
        asset: opts.asset,
        json: Boolean(opts.json),
      });
    });

  program
    .command("setup")
    .description("Initialize MarketBot workspace and config")
    .action(async () => {
      await setupCommand();
    });

  program
    .command("server")
    .description("Start MarketBot HTTP gateway")
    .option("--host <host>", "Bind host")
    .option("--port <port>", "Bind port")
    .option("--gui", "Serve the GUI on /", false)
    .action(async (opts) => {
      const port = opts.port ? Number(opts.port) : undefined;
      await serverCommand({ host: opts.host, port, enableGui: Boolean(opts.gui) });
    });

  program
    .command("gui")
    .description("Start MarketBot GUI (web)")
    .option("--host <host>", "Bind host")
    .option("--port <port>", "Bind port")
    .option("--no-open", "Do not open the browser automatically")
    .action(async (opts) => {
      const port = opts.port ? Number(opts.port) : undefined;
      await guiCommand({ host: opts.host, port, open: Boolean(opts.open) });
    });

  program
    .command("tui")
    .description("Start MarketBot TUI (interactive terminal)")
    .option("--json", "Output JSON instead of the report", false)
    .option("--live", "Use live data providers", false)
    .option("--mode <mode>", "Data mode: auto | api | scrape")
    .option("--search", "Enable web search + scrape fallback", false)
    .option("--scrape", "Force scrape mode + enable web search", false)
    .option("--agent <id>", "Agent id (maps to workspace)")
    .option("--session <key>", "Override session key")
    .action(async (opts) => {
      await tuiCommand({
        json: Boolean(opts.json),
        live: Boolean(opts.live),
        mode: opts.mode,
        search: Boolean(opts.search),
        scrape: Boolean(opts.scrape),
        agentId: opts.agent,
        sessionKey: opts.session,
      });
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
    .option("--session <key>", "Override session key")
    .action(async (opts) => {
      await skillsListCommand({ json: Boolean(opts.json), agentId: opts.agent });
    });

  skills
    .command("check")
    .description("Check skill eligibility and requirements")
    .option("--json", "Output JSON", false)
    .option("--eligible", "Only show eligible skills", false)
    .option("--verbose", "Show missing requirements and paths", false)
    .option("--agent <id>", "Agent id (maps to workspace)")
    .option("--session <key>", "Override session key")
    .action(async (opts) => {
      await skillsCheckCommand({
        json: Boolean(opts.json),
        eligible: Boolean(opts.eligible),
        verbose: Boolean(opts.verbose),
        agentId: opts.agent,
      });
    });

  skills
    .command("info <name>")
    .description("Show details about a skill")
    .option("--json", "Output JSON", false)
    .option("--agent <id>", "Agent id (maps to workspace)")
    .option("--session <key>", "Override session key")
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
    .option("--session <key>", "Override session key")
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
    .option("--session <key>", "Override session key")
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
    .option("--agent <id>", "Agent id (maps to tool policy)")
    .action(async (opts) => {
      await toolsListCommand({ json: Boolean(opts.json), agentId: opts.agent });
    });

  tools
    .command("info <name>")
    .description("Show details about a tool")
    .option("--json", "Output JSON", false)
    .option("--agent <id>", "Agent id (maps to tool policy)")
    .action(async (name: string, opts) => {
      await toolsInfoCommand({ name, json: Boolean(opts.json), agentId: opts.agent });
    });

  tools
    .command("run <name> [args...]")
    .description("Run a tool by name")
    .option("--json", "Output JSON", false)
    .option("--agent <id>", "Agent id (maps to tool policy)")
    .action(async (name: string, args: string[], opts) => {
      await toolsRunCommand({ name, args, json: Boolean(opts.json), agentId: opts.agent });
    });

  tools
    .command("log")
    .description("Show recent tool invocations")
    .option("--limit <n>", "Number of entries to show", "20")
    .option("--json", "Output JSON", false)
    .option("--agent <id>", "Agent id (maps to workspace)")
    .action(async (opts) => {
      const limit = opts.limit ? Number(opts.limit) : undefined;
      await toolsLogCommand({ limit, json: Boolean(opts.json), agentId: opts.agent });
    });

  return program;
}
