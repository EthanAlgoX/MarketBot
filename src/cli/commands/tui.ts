import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { select, password } from "@inquirer/prompts";
import { createDefaultDeps } from "../deps.js";
import { loadConfig } from "../../config/io.js";
import { resolveAgentConfig, resolveDefaultAgentId } from "../../agents/agentScope.js";
import { SessionStore } from "../../session/store.js";
import { runMarketBot } from "../../core/pipeline.js";
import type { MarketBotRunPhase, MarketBotRunPhaseEvent } from "../../core/types.js";
import { getCredentials } from "../../core/auth/oauth.js";

export type TuiOptions = {
  json?: boolean;
  live?: boolean;
  mock?: boolean;
  mode?: string;
  search?: boolean;
  scrape?: boolean;
  agentId?: string;
  sessionKey?: string;
  llmModel?: string;
};

const TUI_COMMANDS = [
  "/help", "/exit", "/quit", "/options", "/history", "/use", "/last",
  "/json", "/mode", "/search", "/scrape", "/live", "/mock",
  "/agent", "/session", "/models", "/model", "/provider",
];

function tuiCompleter(line: string): [string[], string] {
  if (!line.startsWith("/")) {
    return [[], line];
  }
  const hits = TUI_COMMANDS.filter((cmd) => cmd.startsWith(line));
  return [hits.length ? hits : TUI_COMMANDS, line];
}

const COMMAND_MENU_CHOICES = [
  { name: "/help       - Show help", value: "/help" },
  { name: "/options    - Show current options", value: "/options" },
  { name: "/models     - List available models", value: "/models" },
  { name: "/model      - Set model", value: "/model" },
  { name: "/provider   - Set LLM provider", value: "/provider" },
  { name: "/mode       - Set data mode", value: "/mode" },
  { name: "/mock       - Toggle mock mode", value: "/mock toggle" },
  { name: "/json       - Toggle JSON output", value: "/json toggle" },
  { name: "/history    - Show history", value: "/history" },
  { name: "/last       - Re-run last query", value: "/last" },
  { name: "/exit       - Quit TUI", value: "/exit" },
];

async function showCommandMenu(): Promise<string | null> {
  try {
    const answer = await select({
      message: "Select a command:",
      choices: COMMAND_MENU_CHOICES,
      pageSize: 12,
    });
    return answer;
  } catch {
    // User cancelled with Ctrl+C
    return null;
  }
}

async function showProviderMenu(currentProvider?: string): Promise<string | null> {
  try {
    const answer = await select({
      message: `Select LLM provider (current: ${currentProvider ?? "auto"})`,
      choices: [
        { name: "OpenAI (ChatGPT, GPT-4o)", value: "openai" },
        { name: "Gemini (Google AI)", value: "gemini" },
        { name: "Claude (Anthropic)", value: "claude" },
        { name: "DeepSeek (深度求索)", value: "deepseek" },
        { name: "Qwen (阿里通义千问)", value: "qwen" },
        { name: "Moonshot (月之暗面 Kimi)", value: "moonshot" },
        { name: "Ollama (Local LLM)", value: "ollama" },
        { name: "Auto (detect from credentials)", value: "auto" },
      ],
      pageSize: 10,
    });
    return answer;
  } catch {
    return null;
  }
}

const PROVIDER_API_INFO: Record<string, { envVar: string; name: string; baseUrl: string; defaultModel: string }> = {
  openai: { envVar: "OPENAI_API_KEY", name: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  gemini: { envVar: "GEMINI_API_KEY", name: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.0-flash" },
  claude: { envVar: "ANTHROPIC_API_KEY", name: "Claude/Anthropic", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-3-haiku-20240307" },
  deepseek: { envVar: "DEEPSEEK_API_KEY", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
  qwen: { envVar: "DASHSCOPE_API_KEY", name: "Qwen/DashScope", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus" },
  moonshot: { envVar: "MOONSHOT_API_KEY", name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", defaultModel: "moonshot-v1-8k" },
};

async function testApiConnection(provider: string, apiKey: string): Promise<{ success: boolean; message: string; model?: string }> {
  const info = PROVIDER_API_INFO[provider];
  if (!info) return { success: true, message: "Skipped (no API key required)" };

  console.log(`⏳ Testing connection to ${info.name}...`);

  try {
    // First try to list models to verify API key works
    const modelsRes = await fetch(`${info.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "claude" ? { "anthropic-version": "2023-06-01" } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (modelsRes.ok) {
      const data = await modelsRes.json() as { data?: Array<{ id: string }> };
      const modelCount = Array.isArray(data.data) ? data.data.length : 0;
      return {
        success: true,
        message: `Connected successfully! Found ${modelCount} available models.`,
        model: info.defaultModel,
      };
    }

    // If models endpoint fails (some providers don't support it), try a minimal chat completion
    const chatRes = await fetch(`${info.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "claude" ? { "anthropic-version": "2023-06-01" } : {}),
      },
      body: JSON.stringify({
        model: info.defaultModel,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (chatRes.ok) {
      return {
        success: true,
        message: `Connected successfully! Model: ${info.defaultModel}`,
        model: info.defaultModel,
      };
    }

    const errorData = await chatRes.text();
    // Check for common error patterns
    if (chatRes.status === 401 || errorData.includes("invalid_api_key") || errorData.includes("Unauthorized")) {
      return { success: false, message: "Invalid API key. Please check and try again." };
    }
    if (chatRes.status === 403) {
      return { success: false, message: "API key lacks required permissions." };
    }
    if (errorData.includes("insufficient_quota") || errorData.includes("rate_limit")) {
      return { success: true, message: `Connected (quota/rate limit warning). Model: ${info.defaultModel}`, model: info.defaultModel };
    }

    return { success: false, message: `Connection failed (${chatRes.status}): ${errorData.slice(0, 100)}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("TimeoutError")) {
      return { success: false, message: "Connection timeout. Check your network or try again." };
    }
    return { success: false, message: `Connection error: ${msg}` };
  }
}

async function promptForApiKey(provider: string): Promise<string | null> {
  const info = PROVIDER_API_INFO[provider];
  if (!info) return null; // Ollama and auto don't need API key

  try {
    const key = await password({
      message: `Enter ${info.name} API Key (${info.envVar}):`,
      mask: "*",
    });
    return key?.trim() || null;
  } catch {
    return null;
  }
}

export async function tuiCommand(opts: TuiOptions = {}): Promise<void> {
  const rl = readline.createInterface({
    input,
    output,
    completer: tuiCompleter,
  });
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
    llmModel: undefined as string | undefined,
    llmProvider: undefined as string | undefined,
    apiKeys: {} as Record<string, string>,
    history: [] as string[],
  };

  console.log("\nMarketBot TUI");
  console.log("Type a query and press Enter.");
  console.log('Type "/" for command menu\n');

  let exiting = false;
  rl.on("SIGINT", () => {
    exiting = true;
    rl.close();
  });

  // Custom input that detects "/" and auto-shows menu
  async function getInput(): Promise<string | null> {
    return new Promise((resolve) => {
      process.stdout.write("mb> ");

      const onKeypress = async (char: string, key: { name?: string; ctrl?: boolean }) => {
        if (key?.ctrl && key.name === "c") {
          input.removeListener("keypress", onKeypress);
          input.setRawMode(false);
          resolve(null);
          return;
        }

        if (char === "/") {
          input.removeListener("keypress", onKeypress);
          input.setRawMode(false);
          process.stdout.write("/\n");

          // Show menu immediately
          const selectedCommand = await showCommandMenu();
          resolve(selectedCommand);
          return;
        }

        // For any other character, fall back to regular readline
        input.removeListener("keypress", onKeypress);
        input.setRawMode(false);

        // Put the character back and use readline for the rest
        const restOfLine = await rl.question(char);
        resolve(char + restOfLine);
      };

      input.setRawMode(true);
      input.resume();
      input.on("keypress", onKeypress);
    });
  }

  while (!exiting) {
    let line: string | null = "";
    try {
      line = await getInput();
    } catch (err) {
      if (String(err).includes("readline was closed")) break;
      throw err;
    }
    if (line === null) {
      exiting = true;
      break;
    }
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Show interactive menu when user types just "/"
    if (trimmed === "/") {
      const selectedCommand = await showCommandMenu();
      if (!selectedCommand) continue; // User cancelled
      const handled = handleCommand(selectedCommand, state);
      if (handled.exit) break;
      if (handled.message) console.log(handled.message);
      if (handled.action === "models") {
        const message = await openModelSelector(state, rl, handled.filter);
        if (message) console.log(message);
      }
      if (handled.action === "provider") {
        const selected = await showProviderMenu(state.llmProvider);
        if (selected && selected !== "auto") {
          state.llmProvider = selected;
          // Always prompt for API key for providers that need it
          const info = PROVIDER_API_INFO[selected];
          if (info && !state.apiKeys[selected]) {
            const hasEnvKey = Boolean(process.env[info.envVar]);
            if (hasEnvKey) {
              console.log(`ℹ Using ${info.envVar} from environment. Press Enter to keep, or enter new key to override.`);
            }
            const key = await promptForApiKey(selected);
            if (key) {
              state.apiKeys[selected] = key;
              // Test connection with the new API key
              const testResult = await testApiConnection(selected, key);
              if (testResult.success) {
                console.log(`✓ ${testResult.message}`);
              } else {
                console.log(`✗ ${testResult.message}`);
              }
            } else if (hasEnvKey) {
              // Test connection with environment key
              const testResult = await testApiConnection(selected, process.env[info.envVar]!);
              if (testResult.success) {
                console.log(`✓ ${testResult.message}`);
              } else {
                console.log(`✗ ${testResult.message}`);
              }
            } else {
              console.log(`⚠ No API key provided. Set ${info.envVar} or use /provider to enter again.`);
            }
          }
          console.log(`provider: ${state.llmProvider}`);
        } else if (selected === "auto") {
          state.llmProvider = undefined;
          console.log("provider: auto");
        }
      }
      if (handled.runQuery) {
        await runQuery(handled.runQuery, state, deps, rl);
      }
      continue;
    }

    if (trimmed.startsWith("/")) {
      const handled = handleCommand(trimmed, state);
      if (handled.exit) break;
      if (handled.message) console.log(handled.message);
      if (handled.action === "models") {
        const message = await openModelSelector(state, rl, handled.filter);
        if (message) console.log(message);
      }
      if (handled.action === "provider") {
        const selected = await showProviderMenu(state.llmProvider);
        if (selected && selected !== "auto") {
          state.llmProvider = selected;
          // Always prompt for API key for providers that need it
          const info = PROVIDER_API_INFO[selected];
          if (info && !state.apiKeys[selected]) {
            const hasEnvKey = Boolean(process.env[info.envVar]);
            if (hasEnvKey) {
              console.log(`ℹ Using ${info.envVar} from environment. Press Enter to keep, or enter new key to override.`);
            }
            const key = await promptForApiKey(selected);
            if (key) {
              state.apiKeys[selected] = key;
              // Test connection with the new API key
              const testResult = await testApiConnection(selected, key);
              if (testResult.success) {
                console.log(`✓ ${testResult.message}`);
              } else {
                console.log(`✗ ${testResult.message}`);
              }
            } else if (hasEnvKey) {
              // Test connection with environment key
              const testResult = await testApiConnection(selected, process.env[info.envVar]!);
              if (testResult.success) {
                console.log(`✓ ${testResult.message}`);
              } else {
                console.log(`✗ ${testResult.message}`);
              }
            } else {
              console.log(`⚠ No API key provided. Set ${info.envVar} or use /provider to enter again.`);
            }
          }
          console.log(`provider: ${state.llmProvider}`);
        } else if (selected === "auto") {
          state.llmProvider = undefined;
          console.log("provider: auto");
        }
      }
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
  llmModel?: string;
  llmProvider?: string;
  history: string[];
}): { exit?: boolean; message?: string; runQuery?: string; action?: "models" | "provider"; filter?: string } {
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
          "/models [filter]",
          "/model <id|clear|status|list>",
          "/provider <openai|gemini|auto|status>",
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
          `model: ${state.llmModel ?? "default"}`,
          `provider: ${state.llmProvider ?? "auto"}`,
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
    case "models":
      return { action: "models", filter: arg };
    case "model":
      if (!arg) {
        return { action: "models" };
      }
      if (arg === "clear") {
        state.llmModel = undefined;
        return { message: "model: default" };
      }
      if (arg === "list" || arg === "models") {
        return { action: "models" };
      }
      if (arg === "status" || arg === "current" || arg === "show") {
        return { message: `model: ${state.llmModel ?? "default"}` };
      }
      state.llmModel = arg;
      return { message: `model: ${arg}` };
    case "provider": {
      const VALID_PROVIDERS = ["openai", "gemini", "claude", "deepseek", "qwen", "moonshot", "ollama", "auto"];
      if (!arg) {
        return { action: "provider" };
      }
      if (arg === "status" || arg === "current") {
        return { message: `provider: ${state.llmProvider ?? "auto"}` };
      }
      if (arg === "auto" || arg === "clear") {
        state.llmProvider = undefined;
        return { message: "provider: auto" };
      }
      if (VALID_PROVIDERS.includes(arg)) {
        state.llmProvider = arg;
        return { message: `provider: ${arg}` };
      }
      return { message: `Invalid provider. Use: ${VALID_PROVIDERS.join(", ")}` };
    }
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
    llmModel?: string;
    llmProvider?: string;
    apiKeys: Record<string, string>;
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    if (msg.includes("insufficient_quota") || msg.includes("429")) {
      console.log("\nTip: Limit exceeded? Try switching to mock mode by typing:\n  /mode mock\n");
    }
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
    llmModel?: string;
    llmProvider?: string;
    apiKeys: Record<string, string>;
  },
  deps: ReturnType<typeof createDefaultDeps>,
): Promise<string> {
  const mode = parseMode(
    state.mode ?? (state.scrape ? "scrape" : state.live ? "auto" : state.mock ? "mock" : undefined),
  );
  const enableSearch = state.search || state.scrape ? true : undefined;
  const dataOptions = mode || enableSearch ? { mode, enableSearch } : undefined;

  const config = await loadConfig(process.cwd(), { validate: true });
  if (state.llmModel) {
    if (!config.llm) config.llm = {};
    config.llm.model = state.llmModel;
  }
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

  // Apply TUI provider and API key selection
  if (state.llmProvider && !state.mock) {
    if (!config.llm) config.llm = {};
    const sessionKey = state.apiKeys[state.llmProvider];

    switch (state.llmProvider) {
      case "openai":
        config.llm.provider = "openai-compatible";
        config.llm.baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
        if (sessionKey) config.llm.apiKey = sessionKey;
        break;
      case "gemini":
        config.llm.provider = "openai-compatible"; // Uses OpenAI-compatible API
        config.llm.baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
        if (sessionKey) config.llm.apiKey = sessionKey;
        else if (process.env.GEMINI_API_KEY) config.llm.apiKey = process.env.GEMINI_API_KEY;
        break;
      case "claude":
        config.llm.provider = "openai-compatible";
        config.llm.baseUrl = "https://api.anthropic.com/v1";
        config.llm.headers = { ...config.llm.headers, "anthropic-version": "2023-06-01" };
        if (sessionKey) config.llm.apiKey = sessionKey;
        else if (process.env.ANTHROPIC_API_KEY) config.llm.apiKey = process.env.ANTHROPIC_API_KEY;
        break;
      case "deepseek":
        config.llm.provider = "openai-compatible";
        config.llm.baseUrl = "https://api.deepseek.com/v1";
        // Override model unless already set to a deepseek model
        if (!config.llm.model || !config.llm.model.startsWith("deepseek")) {
          config.llm.model = "deepseek-chat";
        }
        if (sessionKey) config.llm.apiKey = sessionKey;
        else if (process.env.DEEPSEEK_API_KEY) config.llm.apiKey = process.env.DEEPSEEK_API_KEY;
        break;
      case "qwen":
        config.llm.provider = "openai-compatible";
        config.llm.baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
        // Override model unless already set to a qwen model
        if (!config.llm.model || !config.llm.model.startsWith("qwen")) {
          config.llm.model = "qwen-plus";
        }
        if (sessionKey) config.llm.apiKey = sessionKey;
        else if (process.env.DASHSCOPE_API_KEY) config.llm.apiKey = process.env.DASHSCOPE_API_KEY;
        else if (process.env.QWEN_API_KEY) config.llm.apiKey = process.env.QWEN_API_KEY;
        break;
      case "moonshot":
        config.llm.provider = "openai-compatible";
        config.llm.baseUrl = "https://api.moonshot.cn/v1";
        // Override model unless already set to a moonshot model
        if (!config.llm.model || !config.llm.model.startsWith("moonshot")) {
          config.llm.model = "moonshot-v1-8k";
        }
        if (sessionKey) config.llm.apiKey = sessionKey;
        else if (process.env.MOONSHOT_API_KEY) config.llm.apiKey = process.env.MOONSHOT_API_KEY;
        break;
      case "ollama":
        config.llm.provider = "openai-compatible";
        config.llm.baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
        // Override model unless already set to a local model (not gpt/gemini/claude/deepseek/qwen/moonshot)
        if (!config.llm.model || /^(gpt|gemini|claude|deepseek|qwen|moonshot)/i.test(config.llm.model)) {
          config.llm.model = "llama3.2";
        }
        config.llm.apiKey = "ollama";
        break;
    }
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

  let resolvedAsset: string | undefined;
  const onPhase = state.json ? undefined : (event: MarketBotRunPhaseEvent) => {
    if (event.status === "start") {
      const target = resolvedAsset || query;
      console.log(`🧭 正在调用 ${phaseToolName(event.phase)} 工具来分析 ${target}`);
      return;
    }
    if (event.status === "end") {
      if (event.phase === "intent") {
        const detail = event.detail as { asset?: string } | undefined;
        if (detail?.asset) resolvedAsset = detail.asset;
      }
      const summary = formatPhaseSummary(event.phase, event.detail);
      if (summary) {
        console.log(`✅ 结论是 ${summary}`);
      } else {
        console.log(`✅ ${phaseToolName(event.phase)} 完成`);
      }
      return;
    }
    if (event.status === "error") {
      console.error(`❌ ${phaseToolName(event.phase)} 失败: ${event.error ?? "未知错误"}`);
    }
  };

  const outputs = await runMarketBot({
    userQuery: query,
    dataOptions,
    agentId: agentId,
    dataService: { getMarketDataFromIntent: deps.getMarketDataFromIntent },
    provider,
    onPhase,
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

function phaseToolName(phase: MarketBotRunPhase): string {
  const map: Record<MarketBotRunPhase, string> = {
    intent: "意图解析",
    market_data: "行情获取",
    interpret: "数据解读",
    regime: "市场结构判断",
    risk: "风险评估",
    reflection: "复盘校验",
    report: "报告生成",
  };
  return map[phase] ?? phase;
}

function formatPhaseSummary(phase: MarketBotRunPhase, detail: unknown): string | null {
  if (!detail) {
    if (phase === "report") return "报告生成完成";
    return null;
  }

  switch (phase) {
    case "intent": {
      const intent = detail as {
        asset?: string;
        market?: string;
        analysis_goal?: string;
        timeframes?: string[];
      };
      const asset = intent.asset ?? "未知资产";
      const market = formatMarket(intent.market);
      const goal = formatGoal(intent.analysis_goal);
      const frames = intent.timeframes?.length ? intent.timeframes.join(", ") : "默认周期";
      return `资产 ${asset}，市场 ${market}，目标 ${goal}，周期 ${frames}`;
    }
    case "market_data": {
      const marketData = detail as {
        current_price?: number;
        price_structure?: { support_levels?: number[]; resistance_levels?: number[] };
      };
      const price = typeof marketData.current_price === "number" ? marketData.current_price : undefined;
      const support = marketData.price_structure?.support_levels?.[0];
      const resistance = marketData.price_structure?.resistance_levels?.[0];
      const parts = [];
      if (price !== undefined) parts.push(`最新价 ${formatNumber(price)}`);
      if (support !== undefined) parts.push(`支撑 ${formatNumber(support)}`);
      if (resistance !== undefined) parts.push(`阻力 ${formatNumber(resistance)}`);
      return parts.length ? parts.join("，") : "行情数据已获取";
    }
    case "interpret": {
      const interpret = detail as {
        market_structure?: string;
        volatility_state?: string;
        momentum?: string;
      };
      const structure = formatStructure(interpret.market_structure);
      const volatility = formatVolatility(interpret.volatility_state);
      const momentum = formatMomentum(interpret.momentum);
      return `结构 ${structure}，动量 ${momentum}，波动 ${volatility}`;
    }
    case "regime": {
      const regime = detail as {
        regime?: string;
        recommended_strategy?: string;
        confidence?: number;
      };
      const conf = typeof regime.confidence === "number" ? `${Math.round(regime.confidence * 100)}%` : "未知";
      return `状态 ${formatRegime(regime.regime)}，策略 ${formatStrategy(regime.recommended_strategy)}，置信 ${conf}`;
    }
    case "risk": {
      const risk = detail as {
        risk_level?: string;
        position_size_recommendation?: string;
        stop_loss_suggestion?: string;
      };
      return `风险 ${formatRisk(risk.risk_level)}，仓位 ${formatPosition(risk.position_size_recommendation)}，止损 ${formatStop(risk.stop_loss_suggestion)}`;
    }
    case "reflection": {
      const reflection = detail as {
        confidence_score?: number;
        recommendation_strength?: string;
      };
      const conf = typeof reflection.confidence_score === "number" ? `${Math.round(reflection.confidence_score * 100)}%` : "未知";
      return `强度 ${formatStrength(reflection.recommendation_strength)}，置信 ${conf}`;
    }
    case "report":
      return "报告生成完成";
    default:
      return null;
  }
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : String(value);
}

function formatMarket(value?: string): string {
  switch (value) {
    case "stocks":
      return "股票";
    case "crypto":
      return "加密";
    case "forex":
      return "外汇";
    case "commodities":
      return "大宗";
    case "futures":
      return "期货";
    default:
      return value ?? "未知";
  }
}

function formatGoal(value?: string): string {
  switch (value) {
    case "general_analysis":
      return "综合分析";
    case "risk_check":
      return "风险检查";
    case "entry_signal":
      return "入场信号";
    case "exit_signal":
      return "出场信号";
    default:
      return value ?? "未知";
  }
}

function formatStructure(value?: string): string {
  switch (value) {
    case "trending_up":
      return "上行趋势";
    case "trending_down":
      return "下行趋势";
    case "ranging":
      return "区间震荡";
    case "volatile":
      return "高波动";
    default:
      return value ?? "未知";
  }
}

function formatVolatility(value?: string): string {
  switch (value) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return value ?? "未知";
  }
}

function formatMomentum(value?: string): string {
  switch (value) {
    case "strong_bullish":
      return "强多";
    case "bullish":
      return "偏多";
    case "neutral":
      return "中性";
    case "bearish":
      return "偏空";
    case "strong_bearish":
      return "强空";
    default:
      return value ?? "未知";
  }
}

function formatRegime(value?: string): string {
  switch (value) {
    case "bull_trend":
      return "牛市趋势";
    case "bear_trend":
      return "熊市趋势";
    case "accumulation":
      return "吸筹";
    case "distribution":
      return "派发";
    case "choppy":
      return "震荡";
    default:
      return value ?? "未知";
  }
}

function formatStrategy(value?: string): string {
  switch (value) {
    case "trend_following":
      return "趋势跟随";
    case "mean_reversion":
      return "均值回归";
    case "wait":
      return "观望";
    case "hedge":
      return "对冲";
    default:
      return value ?? "未知";
  }
}

function formatRisk(value?: string): string {
  switch (value) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    case "extreme":
      return "极高";
    default:
      return value ?? "未知";
  }
}

function formatPosition(value?: string): string {
  switch (value) {
    case "full":
      return "满仓";
    case "half":
      return "半仓";
    case "quarter":
      return "四分之一仓";
    case "none":
      return "空仓";
    default:
      return value ?? "未知";
  }
}

function formatStop(value?: string): string {
  switch (value) {
    case "tight":
      return "紧";
    case "normal":
      return "常规";
    case "wide":
      return "宽";
    default:
      return value ?? "未知";
  }
}

function formatStrength(value?: string): string {
  switch (value) {
    case "strong":
      return "强";
    case "moderate":
      return "中";
    case "weak":
      return "弱";
    default:
      return value ?? "未知";
  }
}

function parseMode(value?: string): "mock" | "auto" | "api" | "scrape" | undefined {
  if (!value) return undefined;
  if (value === "mock" || value === "auto" || value === "api" || value === "scrape") return value;
  return undefined;
}

type ModelListContext =
  | { kind: "mock" }
  | { kind: "error"; message: string }
  | {
    kind: "openai-compatible";
    baseUrl: string;
    apiKey: string;
    headers?: Record<string, string>;
    source: string;
  };

async function openModelSelector(
  state: {
    mock: boolean;
    llmModel?: string;
    llmProvider?: string;
  },
  rl: readline.Interface,
  filter?: string,
): Promise<string | undefined> {
  const config = await loadConfig(process.cwd(), { validate: true });
  const context = await resolveModelListContext(config, state);
  if (context.kind === "mock") {
    return "Mock provider has no models to list.";
  }
  if (context.kind === "error") {
    return context.message;
  }

  const endpoint = `${context.baseUrl.replace(/\/$/, "")}/models`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${context.apiKey}`,
  };
  if (context.headers) {
    Object.assign(headers, context.headers);
  }

  const res = await fetch(endpoint, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text();
    return formatModelListError(res.status, text);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const models = extractModelIds(data);
  if (!models.length) {
    return "No models returned by the provider.";
  }

  let currentFilter = filter?.trim() || "";
  let page = 0;
  const pageSize = 12;
  const current = state.llmModel || config.llm?.model;

  while (true) {
    const normalizedFilter = currentFilter.toLowerCase();
    const filtered = normalizedFilter
      ? models.filter((model) => model.toLowerCase().includes(normalizedFilter))
      : models;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(Math.max(page, 0), totalPages - 1);
    const start = page * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    console.log("");
    console.log(`Models (${filtered.length}${normalizedFilter ? ` of ${models.length}` : ""}) · ${context.source}`);
    if (current) console.log(`Current: ${current}`);
    console.log(`Filter: ${currentFilter || "none"} · Page ${page + 1}/${totalPages}`);
    if (!pageItems.length) {
      console.log("No matches. Enter a new filter or 'q' to quit.");
    } else {
      pageItems.forEach((model, idx) => {
        const index = start + idx + 1;
        console.log(`${index}. ${model}`);
      });
    }
    console.log("Enter number to select, text to filter, n/p for page, q to quit.");

    let answer = "";
    try {
      answer = await rl.question("models> ");
    } catch (err) {
      if (String(err).includes("readline was closed")) return "Model picker closed.";
      throw err;
    }

    const trimmed = answer.trim();
    if (!trimmed || trimmed.toLowerCase() === "q") {
      return "Model picker cancelled.";
    }
    if (trimmed.toLowerCase() === "n") {
      page += 1;
      continue;
    }
    if (trimmed.toLowerCase() === "p") {
      page -= 1;
      continue;
    }

    const index = Number(trimmed);
    if (Number.isFinite(index)) {
      const target = filtered[index - 1];
      if (!target) {
        console.log("Invalid selection.");
        continue;
      }
      state.llmModel = target;
      return `model: ${target}`;
    }

    currentFilter = trimmed;
    page = 0;
  }
}

function formatModelListError(status: number, text: string): string {
  if (status === 403) {
    if (text.includes("api.model.read") || text.includes("model.read")) {
      return [
        "Model list failed: missing api.model.read permission.",
        "Fix: use a key with model.read scope, or sign in via OpenAI OAuth.",
        "You can still set a model manually: /model <id>.",
      ].join("\n");
    }
    return [
      "Model list failed: permission denied.",
      "You can still set a model manually: /model <id>.",
    ].join("\n");
  }
  return `Model list failed (${status}): ${text}`;
}

function extractModelIds(payload: Record<string, unknown>): string[] {
  const candidates =
    Array.isArray(payload.data) ? payload.data :
      Array.isArray(payload.models) ? payload.models :
        Array.isArray(payload.items) ? payload.items : [];

  const ids = candidates
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (!entry || typeof entry !== "object") return "";
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const name = typeof record.name === "string" ? record.name : "";
      return id || name || "";
    })
    .filter(Boolean);

  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
}

async function resolveModelListContext(
  config: Awaited<ReturnType<typeof loadConfig>>,
  state: { mock: boolean; llmProvider?: string; apiKeys?: Record<string, string> },
): Promise<ModelListContext> {
  const llm = config.llm ?? {};

  if (state.mock || llm.provider === "mock") {
    return { kind: "mock" };
  }

  // Check explicit provider selection first
  if (state.llmProvider === "openai") {
    const openAiOAuth = await getCredentials("openai-codex");
    if (openAiOAuth?.access_token) {
      return {
        kind: "openai-compatible",
        baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        apiKey: openAiOAuth.access_token,
        headers: llm.headers,
        source: "openai-oauth",
      };
    }
    const sessionKey = state.apiKeys?.openai;
    const envKey = process.env.OPENAI_API_KEY;
    if (sessionKey || envKey) {
      return {
        kind: "openai-compatible",
        baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        apiKey: sessionKey ?? envKey!,
        headers: llm.headers,
        source: sessionKey ? "session" : "env:OPENAI_API_KEY",
      };
    }
    return { kind: "error", message: "OpenAI selected but no credentials found. Set OPENAI_API_KEY or login via OAuth." };
  }

  if (state.llmProvider === "gemini") {
    const googleOAuth = await getCredentials("google");
    if (googleOAuth?.access_token) {
      return {
        kind: "openai-compatible",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: googleOAuth.access_token,
        headers: llm.headers,
        source: "google-oauth",
      };
    }
    const sessionKey = state.apiKeys?.gemini;
    const envKey = process.env.GEMINI_API_KEY;
    if (sessionKey || envKey) {
      return {
        kind: "openai-compatible",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: sessionKey ?? envKey!,
        headers: llm.headers,
        source: sessionKey ? "session" : "env:GEMINI_API_KEY",
      };
    }
    return { kind: "error", message: "Gemini selected but no credentials found. Set GEMINI_API_KEY or login via Google OAuth." };
  }

  if (state.llmProvider === "claude") {
    const sessionKey = state.apiKeys?.claude;
    const envKey = process.env.ANTHROPIC_API_KEY;
    if (sessionKey || envKey) {
      return {
        kind: "openai-compatible",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: sessionKey ?? envKey!,
        headers: { ...llm.headers, "anthropic-version": "2023-06-01" },
        source: sessionKey ? "session" : "env:ANTHROPIC_API_KEY",
      };
    }
    return { kind: "error", message: "Claude selected but no credentials found. Set ANTHROPIC_API_KEY." };
  }

  if (state.llmProvider === "deepseek") {
    const sessionKey = state.apiKeys?.deepseek;
    const envKey = process.env.DEEPSEEK_API_KEY;
    if (sessionKey || envKey) {
      return {
        kind: "openai-compatible",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: sessionKey ?? envKey!,
        headers: llm.headers,
        source: sessionKey ? "session" : "env:DEEPSEEK_API_KEY",
      };
    }
    return { kind: "error", message: "DeepSeek selected but no credentials found. Set DEEPSEEK_API_KEY." };
  }

  if (state.llmProvider === "qwen") {
    const sessionKey = state.apiKeys?.qwen;
    const envKey = process.env.DASHSCOPE_API_KEY ?? process.env.QWEN_API_KEY;
    if (sessionKey || envKey) {
      return {
        kind: "openai-compatible",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        apiKey: sessionKey ?? envKey!,
        headers: llm.headers,
        source: sessionKey ? "session" : "env:DASHSCOPE_API_KEY",
      };
    }
    return { kind: "error", message: "Qwen selected but no credentials found. Set DASHSCOPE_API_KEY or QWEN_API_KEY." };
  }

  if (state.llmProvider === "moonshot") {
    const sessionKey = state.apiKeys?.moonshot;
    const envKey = process.env.MOONSHOT_API_KEY;
    if (sessionKey || envKey) {
      return {
        kind: "openai-compatible",
        baseUrl: "https://api.moonshot.cn/v1",
        apiKey: sessionKey ?? envKey!,
        headers: llm.headers,
        source: sessionKey ? "session" : "env:MOONSHOT_API_KEY",
      };
    }
    return { kind: "error", message: "Moonshot selected but no credentials found. Set MOONSHOT_API_KEY." };
  }

  if (state.llmProvider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
    return {
      kind: "openai-compatible",
      baseUrl,
      apiKey: "ollama", // Ollama doesn't need a real API key
      headers: llm.headers,
      source: "ollama-local",
    };
  }

  // Auto-detect provider (original logic)
  const openAiOAuth = await getCredentials("openai-codex");
  if (openAiOAuth?.access_token) {
    return {
      kind: "openai-compatible",
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: openAiOAuth.access_token,
      headers: llm.headers,
      source: "openai-oauth",
    };
  }

  const googleOAuth = await getCredentials("google");
  if (googleOAuth?.access_token) {
    return {
      kind: "openai-compatible",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: googleOAuth.access_token,
      headers: llm.headers,
      source: "google-oauth",
    };
  }

  if (llm.provider === "openai-compatible") {
    const apiKeyEnv = llm.apiKeyEnv ?? "OPENAI_API_KEY";
    const apiKey = llm.apiKey ?? process.env[apiKeyEnv];
    if (!apiKey) {
      return { kind: "error", message: `Missing API key. Set ${apiKeyEnv} or llm.apiKey.` };
    }
    return {
      kind: "openai-compatible",
      baseUrl: llm.baseUrl ?? "https://api.openai.com/v1",
      apiKey,
      headers: llm.headers,
      source: "config",
    };
  }

  if (process.env.GEMINI_API_KEY) {
    return {
      kind: "openai-compatible",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: process.env.GEMINI_API_KEY,
      headers: llm.headers,
      source: "env:GEMINI_API_KEY",
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      kind: "openai-compatible",
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      headers: llm.headers,
      source: "env:OPENAI_API_KEY",
    };
  }

  return { kind: "error", message: "No LLM credentials found. Configure OAuth or an API key first." };
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
