import { runMarketBot } from "../../core/pipeline.js";
import { readStdin } from "../../core/stdio.js";
import type { CliDeps } from "../deps.js";
import { loadConfig } from "../../config/io.js";
import { resolveAgentConfig, resolveDefaultAgentId } from "../../agents/agentScope.js";
import { SessionStore } from "../../session/store.js";

export type AnalyzeCommandOptions = {
  query?: string;
  json?: boolean;
  live?: boolean;
  mock?: boolean;
  mode?: string;
  search?: boolean;
  scrape?: boolean;
  agentId?: string;
  sessionKey?: string;
};

export async function analyzeCommand(opts: AnalyzeCommandOptions, deps: CliDeps): Promise<void> {
  const input = (opts.query ?? "").trim();
  const stdinQuery = input ? "" : await readStdin();
  const userQuery = (input || stdinQuery).trim();

  if (!userQuery) {
    throw new Error("Query is required. Provide it as an argument or via stdin.");
  }

  const mode = parseMode(
    opts.mode ?? (opts.scrape ? "scrape" : opts.live ? "auto" : opts.mock ? "mock" : undefined),
  );
  const enableSearch = opts.search || opts.scrape ? true : undefined;
  const dataOptions = mode || enableSearch ? { mode, enableSearch } : undefined;

  const config = await loadConfig(process.cwd(), { validate: true });
  const defaultAgentId = resolveDefaultAgentId(config);
  const agentId = opts.agentId ?? defaultAgentId;

  if (opts.agentId) {
    const entry = resolveAgentConfig(config, opts.agentId);
    if (config.agents?.list && !entry) {
      throw new Error(`Unknown agent \"${opts.agentId}\". Run \"marketbot agents add ${opts.agentId}\" first.`);
    }
  }

  const provider = deps.createProvider(config);

  const sessionEnabled = config.sessions?.enabled !== false;
  const sessionKey = opts.sessionKey?.trim() || `agent:${agentId}:main`;
  const sessionStore = sessionEnabled
    ? new SessionStore({
      agentId,
      stateDir: config.sessions?.dir,
      maxEntries: config.sessions?.maxEntries,
      maxEntryChars: config.sessions?.maxEntryChars,
      contextMaxChars: config.sessions?.contextMaxChars,
    })
    : undefined;

  const outputs = await runMarketBot({
    userQuery,
    dataOptions,
    agentId: agentId,
    dataService: { getMarketDataFromIntent: deps.getMarketDataFromIntent },
    provider,
    session: sessionStore
      ? {
        key: sessionKey,
        store: sessionStore,
        includeContext: config.sessions?.includeContext,
      }
      : undefined,
  });

  if (opts.json) {
    console.log(JSON.stringify(outputs, null, 2));
    return;
  }

  console.log(outputs.report);
}

function parseMode(value?: string): "mock" | "auto" | "api" | "scrape" | undefined {
  if (!value) return undefined;
  if (value === "mock" || value === "auto" || value === "api" || value === "scrape") return value;
  return undefined;
}
