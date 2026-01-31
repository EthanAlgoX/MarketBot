import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { analyzeCommand } from "./analyze.js";
import { createDefaultDeps } from "../deps.js";

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
    const line = await rl.question("mb> ");
    const trimmed = line.trim();

    if (!trimmed) continue;

    if (trimmed.startsWith("/")) {
      const handled = handleCommand(trimmed, state);
      if (handled.exit) break;
      if (handled.message) console.log(handled.message);
      if (handled.runQuery) {
        await runQuery(handled.runQuery, state, deps);
      }
      continue;
    }

    await runQuery(trimmed, state, deps);
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
): Promise<void> {
  try {
    await analyzeCommand(
      {
        query,
        json: state.json,
        live: state.live,
        mock: state.mock,
        mode: state.mode,
        search: state.search,
        scrape: state.scrape,
        agentId: state.agentId,
        sessionKey: state.sessionKey,
      },
      deps,
    );
    state.history.unshift(query);
    if (state.history.length > 20) state.history.pop();
    console.log("");
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
