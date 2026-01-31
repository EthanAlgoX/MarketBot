import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createDefaultDeps } from "../deps.js";
import { loadConfig } from "../../config/io.js";
import { resolveAgentConfig, resolveDefaultAgentId } from "../../agents/agentScope.js";
import { SessionStore } from "../../session/store.js";
import { runMarketBot } from "../../core/pipeline.js";

export type TuiOptions = {
  json?: boolean;
  live?: boolean;
  mock?: boolean;
  mode?: string;
  search?: boolean;
  scrape?: boolean;
  agentId?: string;
  sessionKey?: string;
};

export async function tuiCommand(opts: TuiOptions = {}): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const deps = createDefaultDeps();

  const state = {
    json: Boolean(opts.json),
    live: Boolean(opts.live),
    mock: Boolean(opts.mock),
    mode: opts.mode,
    search: Boolean(opts.search),
    scrape: Boolean(opts.scrape),
    agentId: opts.agentId,
    sessionKey: opts.sessionKey,
    history: [] as string[],
  };

  console.log("\nMarketBot TUI");
  console.log("Type a query and press Enter.");
  console.log('Commands: "/help", "/exit"\n');

  let exiting = false;
  rl.on("SIGINT", () => {
    exiting = true;
    rl.close();
  });

  while (!exiting) {
    let line = "";
    try {
      line = await rl.question("mb> ");
    } catch (err) {
      if (String(err).includes("readline was closed")) break;
      throw err;
    }
    const trimmed = line.trim();

    if (!trimmed) continue;

    if (trimmed.startsWith("/")) {
      const handled = handleCommand(trimmed, state);
      if (handled.exit) break;
      if (handled.message) console.log(handled.message);
      if (handled.runQuery) {
        await runQuery(handled.runQuery, state, deps, rl);
      }
      continue;
    }

    await runQuery(trimmed, state, deps, rl);
  }

  rl.close();
  console.log("Bye.");
}

function handleCommand(input: string, state: {
  json: boolean;
  live: boolean;
  mock: boolean;
  mode?: string;
  search: boolean;
  scrape: boolean;
  agentId?: string;
  sessionKey?: string;
  history: string[];
}): { exit?: boolean; message?: string; runQuery?: string } {
  const [command, ...args] = input.slice(1).split(/\s+/);
  const arg = args[0];

  switch (command) {
    case "exit":
    case "quit":
      return { exit: true };
    case "help":
      return {
        message: [
          "Commands:",
          "/help                 Show this help",
          "/exit                 Quit TUI",
          "/options              Show current options",
          "/history [n]          Show recent queries",
          "/use <n>              Re-run a history entry",
          "/last                 Re-run the most recent query",
          "/json on|off|toggle   Toggle JSON output",
          "/mode <mock|auto|api|scrape|none>",
          "/search on|off|toggle",
          "/scrape on|off|toggle",
          "/live on|off|toggle",
          "/mock on|off|toggle",
          "/agent <id|clear>",
          "/session <key|clear>",
        ].join("\n"),
      };
    case "options":
      return {
        message: [
          `json: ${state.json}`,
          `mode: ${state.mode ?? "none"}`,
          `search: ${state.search}`,
          `scrape: ${state.scrape}`,
          `live: ${state.live}`,
          `mock: ${state.mock}`,
          `agent: ${state.agentId ?? "default"}`,
          `session: ${state.sessionKey ?? "auto"}`,
        ].join("\n"),
      };
    case "history": {
      const count = arg ? Math.max(1, Number(arg)) : 10;
      const lines = state.history.slice(0, Number.isFinite(count) ? count : 10);
      if (lines.length === 0) return { message: "No history yet." };
      return {
        message: lines.map((entry, idx) => `${idx + 1}. ${entry}`).join("\n"),
      };
    }
    case "use": {
      const index = Number(arg);
      if (!Number.isFinite(index) || index < 1 || index > state.history.length) {
        return { message: "Usage: /use <n>" };
      }
      const query = state.history[index - 1];
      return { message: `Running: ${query}`, runQuery: query };
    }
    case "last": {
      if (!state.history[0]) return { message: "No history yet." };
      return { message: `Running: ${state.history[0]}`, runQuery: state.history[0] };
    }
    case "json":
      state.json = toggleFlag(state.json, arg);
      return { message: `json: ${state.json}` };
    case "mode":
      if (!arg) return { message: "Usage: /mode <mock|auto|api|scrape|none>" };
      if (arg === "none") {
        state.mode = undefined;
        return { message: "mode: none" };
      }
      if (["mock", "auto", "api", "scrape"].includes(arg)) {
        state.mode = arg;
        return { message: `mode: ${arg}` };
      }
      return { message: "Invalid mode. Use mock|auto|api|scrape|none." };
    case "search":
      state.search = toggleFlag(state.search, arg);
      return { message: `search: ${state.search}` };
    case "scrape":
      state.scrape = toggleFlag(state.scrape, arg);
      return { message: `scrape: ${state.scrape}` };
    case "live":
      state.live = toggleFlag(state.live, arg);
      return { message: `live: ${state.live}` };
    case "mock":
      state.mock = toggleFlag(state.mock, arg);
      return { message: `mock: ${state.mock}` };
    case "agent":
      if (!arg) return { message: "Usage: /agent <id|clear>" };
      if (arg === "clear") {
        state.agentId = undefined;
        return { message: "agent: default" };
      }
      state.agentId = arg;
      return { message: `agent: ${arg}` };
    case "session":
      if (!arg) return { message: "Usage: /session <key|clear>" };
      if (arg === "clear") {
        state.sessionKey = undefined;
        return { message: "session: auto" };
      }
      state.sessionKey = arg;
      return { message: `session: ${arg}` };
    default:
      return { message: `Unknown command: /${command}. Try /help.` };
  }
}

function toggleFlag(current: boolean, arg?: string): boolean {
  if (!arg || arg === "toggle") return !current;
  if (arg === "on") return true;
  if (arg === "off") return false;
  return current;
}

async function runQuery(
  query: string,
  state: {
    json: boolean;
    live: boolean;
    mock: boolean;
    mode?: string;
    search: boolean;
    scrape: boolean;
    agentId?: string;
    sessionKey?: string;
    history: string[];
  },
  deps: ReturnType<typeof createDefaultDeps>,
  rl: readline.Interface,
): Promise<void> {
  try {
    const outputText = await runAnalysis(query, state, deps);
    await pageOutput(outputText, rl, 22);
    state.history.unshift(query);
    if (state.history.length > 20) state.history.pop();
    console.log("");
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function runAnalysis(
  query: string,
  state: {
    json: boolean;
    live: boolean;
    mock: boolean;
    mode?: string;
    search: boolean;
    scrape: boolean;
    agentId?: string;
    sessionKey?: string;
  },
  deps: ReturnType<typeof createDefaultDeps>,
): Promise<string> {
  const mode = parseMode(
    state.mode ?? (state.scrape ? "scrape" : state.live ? "auto" : state.mock ? "mock" : undefined),
  );
  const enableSearch = state.search || state.scrape ? true : undefined;
  const dataOptions = mode || enableSearch ? { mode, enableSearch } : undefined;

  const config = await loadConfig(process.cwd(), { validate: true });
  const defaultAgentId = resolveDefaultAgentId(config);
  const agentId = state.agentId ?? defaultAgentId;

  if (state.agentId) {
    const entry = resolveAgentConfig(config, state.agentId);
    if (config.agents?.list && !entry) {
      throw new Error(`Unknown agent "${state.agentId}". Run "marketbot agents add ${state.agentId}" first.`);
    }
  }

  if (state.mock) {
    if (!config.llm) config.llm = {};
    config.llm.provider = "mock";
  }

  const provider = await deps.createProviderAsync(config);
  const sessionEnabled = config.sessions?.enabled !== false;
  const sessionKey = state.sessionKey?.trim() || `agent:${agentId}:main`;
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
    userQuery: query,
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

  if (state.json) {
    return JSON.stringify(outputs, null, 2);
  }
  return outputs.report;
}

function parseMode(value?: string): "mock" | "auto" | "api" | "scrape" | undefined {
  if (!value) return undefined;
  if (value === "mock" || value === "auto" || value === "api" || value === "scrape") return value;
  return undefined;
}

async function pageOutput(text: string, rl: readline.Interface, pageSize: number): Promise<void> {
  const lines = text.split(/\r?\n/);
  if (lines.length <= pageSize) {
    console.log(text);
    return;
  }

  let index = 0;
  while (index < lines.length) {
    const chunk = lines.slice(index, index + pageSize).join("\n");
    console.log(chunk);
    index += pageSize;
    if (index >= lines.length) break;
    let answer = "";
    try {
      answer = await rl.question("-- more -- (Enter to continue, q to stop) ");
    } catch (err) {
      if (String(err).includes("readline was closed")) break;
      throw err;
    }
    if (answer.trim().toLowerCase() === "q") break;
  }
}
