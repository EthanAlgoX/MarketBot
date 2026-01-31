import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { select, password, confirm } from "@inquirer/prompts";
import { createDefaultDeps } from "../deps.js";
import { loadConfig, writeConfig } from "../../config/io.js";
import { resolveAgentConfig, resolveDefaultAgentId } from "../../agents/agentScope.js";
import { SessionStore } from "../../session/store.js";
import { runMarketBot } from "../../core/pipeline.js";
import type { MarketBotRunPhase, MarketBotRunPhaseEvent } from "../../core/types.js";
import { getCredentials } from "../../core/auth/oauth.js";
import type { MarketBotConfig } from "../../config/types.js";
import { createDefaultToolRegistry } from "../../tools/registry.js";
import { resolveToolAllowlist, resolveToolPolicy } from "../../tools/policy.js";

export type TuiOptions = {
  json?: boolean;
  live?: boolean;
  mode?: string;
  search?: boolean;
  scrape?: boolean;
  agentId?: string;
  sessionKey?: string;
  llmModel?: string;
};

const TUI_COMMANDS = [
  "/help", "/exit", "/quit", "/options", "/history", "/use", "/last",
  "/json", "/mode", "/search", "/scrape", "/live", "/tools",
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
  { name: "/tools      - List available tools", value: "/tools" },
  { name: "/models     - List available models", value: "/models" },
  { name: "/model      - Set model", value: "/model" },
  { name: "/provider   - Set LLM provider", value: "/provider" },
  { name: "/mode       - Set data mode", value: "/mode" },
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
        { name: "Kimi Code (月之暗面 Code)", value: "kimicode" },
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
  kimicode: { envVar: "KIMICODE_API_KEY", name: "Kimi Code", baseUrl: "https://api.kimi.com/coding/v1", defaultModel: "kimi-for-coding" },
  qwen: { envVar: "DASHSCOPE_API_KEY", name: "Qwen/DashScope", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus" },
  moonshot: { envVar: "MOONSHOT_API_KEY", name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", defaultModel: "moonshot-v1-8k" },
};

function inferProviderId(llm?: MarketBotConfig["llm"]): keyof typeof PROVIDER_API_INFO | undefined {
  const baseUrl = llm?.baseUrl?.toLowerCase() ?? "";
  if (baseUrl.includes("api.kimi.com/coding")) return "kimicode";
  if (baseUrl.includes("api.deepseek.com")) return "deepseek";
  if (baseUrl.includes("generativelanguage.googleapis.com")) return "gemini";
  if (baseUrl.includes("api.anthropic.com")) return "claude";
  if (baseUrl.includes("dashscope.aliyuncs.com")) return "qwen";
  if (baseUrl.includes("api.moonshot.cn")) return "moonshot";
  if (baseUrl.includes("api.openai.com")) return "openai";
  return undefined;
}

async function persistProviderSelection(
  providerId: keyof typeof PROVIDER_API_INFO,
  model: string | undefined,
  apiKey: string | undefined,
  cwd: string,
): Promise<void> {
  const info = PROVIDER_API_INFO[providerId];
  const config = await loadConfig(cwd, { validate: true });
  const nextModel = model ?? config.llm?.model ?? info.defaultModel;
  const update: Partial<NonNullable<MarketBotConfig["llm"]>> = {
    provider: "openai-compatible",
    baseUrl: info.baseUrl,
    model: nextModel,
    apiKeyEnv: info.envVar,
  };
  if (apiKey) {
    update.apiKey = apiKey;
  }
  await writeConfig({ ...config, llm: { ...(config.llm ?? {}), ...update } }, cwd);
}

async function persistModelSelection(model: string | undefined, cwd: string): Promise<void> {
  const config = await loadConfig(cwd, { validate: true });
  const nextLlm = { ...(config.llm ?? {}) };
  if (model) nextLlm.model = model;
  else delete nextLlm.model;
  await writeConfig({ ...config, llm: nextLlm }, cwd);
}

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
      if (provider === "moonshot") {
        return { success: true, message: "Moonshot auth check failed (401). Key saved—try a real query to verify." };
      }
      if (provider === "kimicode") {
        return { success: true, message: "Kimi Code auth check failed (401). Key saved—try a real query to verify." };
      }
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
  const initialConfig = await loadConfig(process.cwd(), { validate: true });
  const inferredProvider = inferProviderId(initialConfig.llm);

  const state = {
    json: Boolean(opts.json),
    live: Boolean(opts.live),
    mode: opts.mode,
    search: Boolean(opts.search),
    scrape: Boolean(opts.scrape),
    agentId: opts.agentId,
    sessionKey: opts.sessionKey,
    llmModel: opts.llmModel ?? initialConfig.llm?.model ?? undefined,
    llmProvider: inferredProvider ?? undefined,
    apiKeys: inferredProvider && initialConfig.llm?.apiKey
      ? { [inferredProvider]: initialConfig.llm.apiKey }
      : {} as Record<string, string>,
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
      const prevModel = state.llmModel;
      const handled = handleCommand(selectedCommand, state);
      if (handled.exit) break;
      if (handled.message) console.log(handled.message);
      if (state.llmModel !== prevModel) {
        await persistModelSelection(state.llmModel, process.cwd());
      }
      if (handled.action === "models") {
        const beforeModel = state.llmModel;
        const message = await openModelSelector(state, rl, handled.filter);
        if (message) console.log(message);
        if (state.llmModel !== beforeModel) {
          await persistModelSelection(state.llmModel, process.cwd());
        }
      }
      if (handled.action === "tools") {
        const message = await openToolsList(state, handled.filter);
        if (message) console.log(message);
      }
      if (handled.action === "provider") {
        const selected = await showProviderMenu(state.llmProvider);
        if (selected && selected !== "auto") {
          let currentKey: string | undefined = state.apiKeys[selected];
          let keepTrying = true;
          let shouldSave = false;

          while (keepTrying) {
            // Check if we have a key (from env or session)
            const info = PROVIDER_API_INFO[selected];
            const hasEnvKey = Boolean(process.env[info.envVar]);

            if (!currentKey && hasEnvKey) {
              console.log(`ℹ Using ${info.envVar} from environment.`);
              // We'll test with the env key below
            } else if (!currentKey) {
              // No key known, ask for it
              const key = await promptForApiKey(selected);
              if (!key) {
                // User cancelled entry
                keepTrying = false;
                break;
              }
              currentKey = key;
            }

            // Test connection
            let testResult;
            if (currentKey) {
              testResult = await testApiConnection(selected, currentKey);
            } else if (hasEnvKey) {
              testResult = await testApiConnection(selected, process.env[info.envVar]!);
            } else {
              // Should not happen if promptForApiKey works
              testResult = { success: false, message: "No API key available." };
            }

            if (testResult.success) {
              console.log(`✓ ${testResult.message}`);
              state.apiKeys[selected] = currentKey || ""; // Store it (empty if using env)
              state.llmProvider = selected;
              shouldSave = true;
              keepTrying = false;
            } else {
              console.log(`✗ ${testResult.message}`);
              // Ask user what to do
              const action = await select({
                message: "Connection failed. What would you like to do?",
                choices: [
                  { name: "Try entering API key again", value: "retry" },
                  { name: "Save anyway (ignore error)", value: "force" },
                  { name: "Cancel (do not change provider)", value: "cancel" },
                ],
              });

              if (action === "retry") {
                currentKey = undefined; // Clear so we prompt again
                // Loop continues
              } else if (action === "force") {
                state.apiKeys[selected] = currentKey || "";
                state.llmProvider = selected;
                shouldSave = true;
                keepTrying = false;
              } else {
                // Cancel
                delete state.apiKeys[selected];
                keepTrying = false;
              }
            }
          }

          if (shouldSave) {
            await persistProviderSelection(selected, state.llmModel, state.apiKeys[selected], process.cwd());
            console.log(`provider: ${state.llmProvider}`);
          }
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
      const prevModel = state.llmModel;
      const handled = handleCommand(trimmed, state);
      if (handled.exit) break;
      if (handled.message) console.log(handled.message);
      if (state.llmModel !== prevModel) {
        await persistModelSelection(state.llmModel, process.cwd());
      }
      if (handled.action === "models") {
        const beforeModel = state.llmModel;
        const message = await openModelSelector(state, rl, handled.filter);
        if (message) console.log(message);
        if (state.llmModel !== beforeModel) {
          await persistModelSelection(state.llmModel, process.cwd());
        }
      }
      if (handled.action === "tools") {
        const message = await openToolsList(state, handled.filter);
        if (message) console.log(message);
      }
      if (handled.action === "provider") {
        const selected = await showProviderMenu(state.llmProvider);
        if (selected && selected !== "auto") {
          state.llmProvider = selected;
          let currentKey: string | undefined = state.apiKeys[selected];
          let keepTrying = true;
          let shouldSave = false;

          while (keepTrying) {
            // Check if we have a key (from env or session)
            const info = PROVIDER_API_INFO[selected];
            const hasEnvKey = Boolean(process.env[info.envVar]);

            if (!currentKey && hasEnvKey) {
              console.log(`ℹ Using ${info.envVar} from environment.`);
              // We'll test with the env key below
            } else if (!currentKey) {
              // No key known, ask for it
              const key = await promptForApiKey(selected);
              if (!key) {
                // User cancelled entry
                keepTrying = false;
                break;
              }
              currentKey = key;
            }

            // Test connection
            let testResult;
            if (currentKey) {
              testResult = await testApiConnection(selected, currentKey);
            } else if (hasEnvKey) {
              testResult = await testApiConnection(selected, process.env[info.envVar]!);
            } else {
              // Should not happen if promptForApiKey works
              testResult = { success: false, message: "No API key available." };
            }

            if (testResult.success) {
              console.log(`✓ ${testResult.message}`);
              state.apiKeys[selected] = currentKey || ""; // Store it (empty if using env)
              state.llmProvider = selected;
              shouldSave = true;
              keepTrying = false;
            } else {
              console.log(`✗ ${testResult.message}`);
              // Ask user what to do
              const action = await select({
                message: "Connection failed. What would you like to do?",
                choices: [
                  { name: "Try entering API key again", value: "retry" },
                  { name: "Save anyway (ignore error)", value: "force" },
                  { name: "Cancel (do not change provider)", value: "cancel" },
                ],
              });

              if (action === "retry") {
                currentKey = undefined; // Clear so we prompt again
                // Loop continues
              } else if (action === "force") {
                state.apiKeys[selected] = currentKey || "";
                state.llmProvider = selected;
                shouldSave = true;
                keepTrying = false;
              } else {
                // Cancel
                delete state.apiKeys[selected];
                keepTrying = false;
              }
            }
          }

          if (shouldSave) {
            await persistProviderSelection(selected, state.llmModel, state.apiKeys[selected], process.cwd());
            console.log(`provider: ${state.llmProvider}`);
          }
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
  mode?: string;
  search: boolean;
  scrape: boolean;
  agentId?: string;
  sessionKey?: string;
  llmModel?: string;
  llmProvider?: string;
  history: string[];
}): { exit?: boolean; message?: string; runQuery?: string; action?: "models" | "provider" | "tools"; filter?: string } {
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
          "/mode <auto|api|scrape|none>",
          "/search on|off|toggle",
          "/scrape on|off|toggle",
          "/live on|off|toggle",
          "/tools                List available tools",
          "/agent <id|clear>",
          "/session <key|clear>",
          "/models [filter]",
          "/model <id|clear|status|list>",
          "/provider <openai|gemini|kimicode|auto|status>",
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
      if (!arg) return { message: "Usage: /mode <auto|api|scrape|none>" };
      if (arg === "none") {
        state.mode = undefined;
        return { message: "mode: none" };
      }
      if (["auto", "api", "scrape"].includes(arg)) {
        state.mode = arg;
        return { message: `mode: ${arg}` };
      }
      return { message: "Invalid mode. Use auto|api|scrape|none." };
    case "search":
      state.search = toggleFlag(state.search, arg);
      return { message: `search: ${state.search}` };
    case "scrape":
      state.scrape = toggleFlag(state.scrape, arg);
      return { message: `scrape: ${state.scrape}` };
    case "live":
      state.live = toggleFlag(state.live, arg);
      return { message: `live: ${state.live}` };
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
    case "tools":
      return { action: "tools", filter: arg };
    case "provider": {
      const VALID_PROVIDERS = ["openai", "gemini", "claude", "deepseek", "kimicode", "qwen", "moonshot", "ollama", "auto"];
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
  }
}

async function runAnalysis(
  query: string,
  state: {
    json: boolean;
    live: boolean;
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
    state.mode ?? (state.scrape ? "scrape" : state.live ? "auto" : undefined),
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

  // Apply TUI provider and API key selection
  if (state.llmProvider) {
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
      case "kimicode":
        config.llm.provider = "openai-compatible";
        config.llm.baseUrl = "https://api.kimi.com/coding/v1";
        if (!config.llm.model || !config.llm.model.startsWith("kimi")) {
          config.llm.model = "kimi-for-coding";
        }
        if (sessionKey) config.llm.apiKey = sessionKey;
        else if (process.env.KIMICODE_API_KEY) config.llm.apiKey = process.env.KIMICODE_API_KEY;
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

  // Detect language from query
  const lang = detectLanguage(query);

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
      const toolName = phaseToolName(event.phase, lang);
      const msg = lang === "en"
        ? `🧭 Calling ${toolName} to analyze ${target}`
        : `🧭 正在调用 ${toolName} 工具来分析 ${target}`;
      console.log(msg);
      return;
    }
    if (event.status === "end") {
      if (event.phase === "intent") {
        const detail = event.detail as { asset?: string } | undefined;
        if (detail?.asset) resolvedAsset = detail.asset;
      }
      const summary = formatPhaseSummary(event.phase, event.detail, lang);
      if (summary) {
        const prefix = lang === "en" ? "✅ Result: " : "✅ 结论是 ";
        console.log(`${prefix}${summary}`);
      } else {
        const toolName = phaseToolName(event.phase, lang);
        const suffix = lang === "en" ? " Complete" : " 完成";
        console.log(`✅ ${toolName}${suffix}`);
      }
      return;
    }
    if (event.status === "error") {
      const toolName = phaseToolName(event.phase, lang);
      const prefix = lang === "en" ? "❌ Failed: " : "❌ 失败: ";
      console.error(`${prefix}${toolName} ${event.error ?? "Unknown Error"}`);
    }
  };

  const outputs = await runMarketBot({
    userQuery: query,
    language: lang,
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
    registry: await createDefaultToolRegistry(),
  });

  if (state.json) {
    return JSON.stringify(outputs, null, 2);
  }
  return outputs.report;
}

import { detectLanguage, type Language } from "../../utils/language.js";

// ... existing imports ...

// Helper to get tool name based on language
function phaseToolName(phase: MarketBotRunPhase, lang: Language): string {
  if (lang === "en") {
    const map: Record<MarketBotRunPhase, string> = {
      intent: "Intent Parser",
      market_data: "Market Data Fetcher",
      interpret: "Data Interpreter",
      regime: "Regime Classifier",
      risk: "Risk Assessment",
      reflection: "Reflection/Review",
      report: "Report Generator",
    };
    return map[phase] ?? phase;
  } else {
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
}

// Helper to format phase summary based on language
function formatPhaseSummary(phase: MarketBotRunPhase, detail: unknown, lang: Language): string | null {
  if (!detail) {
    if (phase === "report") return lang === "en" ? "Report Generation Complete" : "报告生成完成";
    return null;
  }

  // Common formatters
  const fmtNum = (v: number) => Number.isFinite(v) ? v.toFixed(2) : String(v);
  const fmtPct = (v: number) => Number.isFinite(v) ? `${Math.round(v * 100)}%` : (lang === "en" ? "Unknown" : "未知");

  // Localized strings
  const t = {
    unknown: lang === "en" ? "Unknown" : "未知",
    asset: lang === "en" ? "Asset" : "资产",
    market: lang === "en" ? "Market" : "市场",
    goal: lang === "en" ? "Goal" : "目标",
    cycle: lang === "en" ? "Cycle" : "周期",
    defaultCycle: lang === "en" ? "Default" : "默认周期",
    price: lang === "en" ? "Price" : "最新价",
    support: lang === "en" ? "Support" : "支撑",
    resistance: lang === "en" ? "Resistance" : "阻力",
    fetched: lang === "en" ? "Data Fetched" : "行情数据已获取",
    structure: lang === "en" ? "Structure" : "结构",
    momentum: lang === "en" ? "Momentum" : "动量",
    volatility: lang === "en" ? "Volatility" : "波动",
    status: lang === "en" ? "Status" : "状态",
    strategy: lang === "en" ? "Strategy" : "策略",
    confidence: lang === "en" ? "Confidence" : "置信",
    risk: lang === "en" ? "Risk" : "风险",
    position: lang === "en" ? "Position" : "仓位",
    stop: lang === "en" ? "Stop" : "止损",
    strength: lang === "en" ? "Strength" : "强度",
  };

  switch (phase) {
    case "intent": {
      const intent = detail as {
        asset?: string;
        market?: string;
        analysis_goal?: string;
        timeframes?: string[];
      };
      const asset = intent.asset ?? t.unknown;
      const market = formatMarket(intent.market, lang);
      const goal = formatGoal(intent.analysis_goal, lang);
      const frames = intent.timeframes?.length ? intent.timeframes.join(", ") : t.defaultCycle;
      return lang === "en"
        ? `${t.asset}: ${asset}, ${t.market}: ${market}, ${t.goal}: ${goal}, ${t.cycle}: ${frames}`
        : `${t.asset} ${asset}，${t.market} ${market}，${t.goal} ${goal}，${t.cycle} ${frames}`;
    }
    case "market_data": {
      const marketData = detail as {
        current_price?: number;
        price_structure?: { support_levels?: number[]; resistance_levels?: number[] };
        source?: string;
        price_type?: string;
        timestamp?: string;
      };
      const price = typeof marketData.current_price === "number" ? marketData.current_price : undefined;
      const support = marketData.price_structure?.support_levels?.[0];
      const resistance = marketData.price_structure?.resistance_levels?.[0];
      const parts = [];
      if (price !== undefined) parts.push(`${t.price} ${fmtNum(price)}`);
      if (support !== undefined) parts.push(`${t.support} ${fmtNum(support)}`);
      if (resistance !== undefined) parts.push(`${t.resistance} ${fmtNum(resistance)}`);
      if (marketData.source) {
        const sourceText = marketData.price_type ? `${marketData.source}(${marketData.price_type})` : marketData.source;
        parts.push(`${lang === "en" ? "Source" : "来源"} ${sourceText}`);
      }
      if (marketData.timestamp) {
        parts.push(`${lang === "en" ? "Time" : "时间"} ${marketData.timestamp}`);
      }
      return parts.length ? parts.join(lang === "en" ? ", " : "，") : t.fetched;
    }
    case "interpret": {
      const interpret = detail as {
        market_structure?: string;
        volatility_state?: string;
        momentum?: string;
      };
      const structure = formatStructure(interpret.market_structure, lang);
      const volatility = formatVolatility(interpret.volatility_state, lang);
      const momentum = formatMomentum(interpret.momentum, lang);
      return lang === "en"
        ? `${t.structure}: ${structure}, ${t.momentum}: ${momentum}, ${t.volatility}: ${volatility}`
        : `${t.structure} ${structure}，${t.momentum} ${momentum}，${t.volatility} ${volatility}`;
    }
    case "regime": {
      const regime = detail as {
        regime?: string;
        recommended_strategy?: string;
        confidence?: number;
      };
      return lang === "en"
        ? `${t.status}: ${formatRegime(regime.regime, lang)}, ${t.strategy}: ${formatStrategy(regime.recommended_strategy, lang)}, ${t.confidence}: ${fmtPct(regime.confidence ?? 0)}`
        : `${t.status} ${formatRegime(regime.regime, lang)}，${t.strategy} ${formatStrategy(regime.recommended_strategy, lang)}，${t.confidence} ${fmtPct(regime.confidence ?? 0)}`;
    }
    case "risk": {
      const risk = detail as {
        risk_level?: string;
        position_size_recommendation?: string;
        stop_loss_suggestion?: string;
      };
      return lang === "en"
        ? `${t.risk}: ${formatRisk(risk.risk_level, lang)}, ${t.position}: ${formatPosition(risk.position_size_recommendation, lang)}, ${t.stop}: ${formatStop(risk.stop_loss_suggestion, lang)}`
        : `${t.risk} ${formatRisk(risk.risk_level, lang)}，${t.position} ${formatPosition(risk.position_size_recommendation, lang)}，${t.stop} ${formatStop(risk.stop_loss_suggestion, lang)}`;
    }
    case "reflection": {
      const reflection = detail as {
        confidence_score?: number;
        recommendation_strength?: string;
      };
      return lang === "en"
        ? `${t.strength}: ${formatStrength(reflection.recommendation_strength, lang)}, ${t.confidence}: ${fmtPct(reflection.confidence_score ?? 0)}`
        : `${t.strength} ${formatStrength(reflection.recommendation_strength, lang)}，${t.confidence} ${fmtPct(reflection.confidence_score ?? 0)}`;
    }
    case "report":
      return lang === "en" ? "Report Generation Complete" : "报告生成完成";
    default:
      return null;
  }
}

// Value Formatters (Bilingual)
function formatMarket(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    stocks: { en: "Stocks", zh: "股票" },
    crypto: { en: "Crypto", zh: "加密" },
    forex: { en: "Forex", zh: "外汇" },
    commodities: { en: "Commodities", zh: "大宗" },
    futures: { en: "Futures", zh: "期货" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function formatGoal(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    general_analysis: { en: "General Analysis", zh: "综合分析" },
    risk_check: { en: "Risk Check", zh: "风险检查" },
    entry_signal: { en: "Entry Signal", zh: "入场信号" },
    exit_signal: { en: "Exit Signal", zh: "出场信号" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function formatStructure(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    trending_up: { en: "Trending Up", zh: "上行趋势" },
    trending_down: { en: "Trending Down", zh: "下行趋势" },
    ranging: { en: "Ranging", zh: "区间震荡" },
    volatile: { en: "Volatile", zh: "高波动" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function formatVolatility(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    high: { en: "High", zh: "高" },
    medium: { en: "Medium", zh: "中" },
    low: { en: "Low", zh: "低" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function formatMomentum(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    strong_bullish: { en: "Strong Bullish", zh: "强多" },
    bullish: { en: "Bullish", zh: "偏多" },
    neutral: { en: "Neutral", zh: "中性" },
    bearish: { en: "Bearish", zh: "偏空" },
    strong_bearish: { en: "Strong Bearish", zh: "强空" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function formatRegime(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    bull_trend: { en: "Bull Trend", zh: "牛市趋势" },
    bear_trend: { en: "Bear Trend", zh: "熊市趋势" },
    accumulation: { en: "Accumulation", zh: "吸筹" },
    distribution: { en: "Distribution", zh: "派发" },
    choppy: { en: "Choppy", zh: "震荡" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function formatStrategy(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    trend_following: { en: "Trend Following", zh: "趋势跟随" },
    mean_reversion: { en: "Mean Reversion", zh: "均值回归" },
    wait: { en: "Wait", zh: "观望" },
    hedge: { en: "Hedge", zh: "对冲" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function formatRisk(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    low: { en: "Low", zh: "低" },
    medium: { en: "Medium", zh: "中" },
    high: { en: "High", zh: "高" },
    extreme: { en: "Extreme", zh: "极高" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function formatPosition(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    full: { en: "Full", zh: "满仓" },
    half: { en: "Half", zh: "半仓" },
    quarter: { en: "Quarter", zh: "四分之一仓" },
    none: { en: "None", zh: "空仓" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function formatStop(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    tight: { en: "Tight", zh: "紧" },
    normal: { en: "Normal", zh: "常规" },
    wide: { en: "Wide", zh: "宽" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function formatStrength(value: string | undefined, lang: Language): string {
  const map: Record<string, { en: string, zh: string }> = {
    strong: { en: "Strong", zh: "强" },
    moderate: { en: "Moderate", zh: "中" },
    weak: { en: "Weak", zh: "弱" }
  };
  return map[value || ""]?.[lang] || (value ?? (lang === "en" ? "Unknown" : "未知"));
}

function parseMode(value?: string): "auto" | "api" | "scrape" | undefined {
  if (!value) return undefined;
  if (value === "auto" || value === "api" || value === "scrape") return value;
  return undefined;
}

type ModelListContext =
  | { kind: "error"; message: string }
  | {
    kind: "openai-compatible";
    baseUrl: string;
    apiKey: string;
    headers?: Record<string, string>;
    source: string;
  };

async function openToolsList(
  state: { agentId?: string },
  filter?: string,
): Promise<string | undefined> {
  const registry = await createDefaultToolRegistry();
  const config = await loadConfig(process.cwd(), { validate: true });
  const allTools = registry.list();
  const policy = resolveToolPolicy(config, state.agentId);
  const allowlist = resolveToolAllowlist(policy, allTools.map((tool: any) => tool.name));
  const allowSet = new Set(allowlist.map((name) => name.toLowerCase()));
  const allowed = allTools.filter((tool: any) => allowSet.has(tool.name.toLowerCase()));

  const normalizedFilter = filter?.trim().toLowerCase();
  const filtered = normalizedFilter
    ? allowed.filter((tool) => tool.name.toLowerCase().includes(normalizedFilter))
    : allowed;

  if (filtered.length === 0) {
    return normalizedFilter ? "No tools matched the filter." : "No tools allowed by policy.";
  }

  console.log("");
  console.log(`Tools (${filtered.length}${normalizedFilter ? ` of ${allowed.length}` : ""})`);
  for (const tool of filtered) {
    const description = tool.description ? ` - ${tool.description}` : "";
    console.log(`${tool.name}${description}`);
  }
  return undefined;
}

async function openModelSelector(
  state: {
    llmModel?: string;
    llmProvider?: string;
    apiKeys: Record<string, string>;
  },
  rl: readline.Interface,
  filter?: string,
): Promise<string | undefined> {
  console.log("⏳ Scanning available models from all providers...");

  const config = await loadConfig(process.cwd(), { validate: true });
  const allModels = await fetchAllAvailableModels(config, state);

  // Add manually configured models
  if (Array.isArray(config.llm?.models)) {
    for (const m of config.llm.models) {
      if (!allModels.some((x) => x.model === m && x.provider === "config")) {
        allModels.push({ provider: "config", model: m, label: `[Config] ${m}` });
      }
    }
  }

  if (allModels.length === 0) {
    return "No models found from configured providers or config.";
  }

  // Sort: providers first (alphabetical), then models
  allModels.sort((a, b) => {
    const pDiff = a.provider.localeCompare(b.provider);
    if (pDiff !== 0) return pDiff;
    return a.model.localeCompare(b.model);
  });

  // UI Loop
  let currentFilter = filter?.trim() || "";
  let page = 0;
  const pageSize = 12;
  const currentModel = state.llmModel;
  const currentProvider = state.llmProvider;

  while (true) {
    const normalizedFilter = currentFilter.toLowerCase();
    const filtered = normalizedFilter
      ? allModels.filter((item) =>
        item.label.toLowerCase().includes(normalizedFilter) ||
        item.provider.toLowerCase().includes(normalizedFilter) ||
        item.model.toLowerCase().includes(normalizedFilter)
      )
      : allModels;

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(Math.max(page, 0), totalPages - 1);
    const start = page * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    console.log("");
    console.log(`Models (${filtered.length}${normalizedFilter ? ` of ${allModels.length}` : ""})`);
    if (currentModel) console.log(`Current: ${currentModel} (${currentProvider ?? "auto"})`);
    console.log(`Filter: ${currentFilter || "none"} · Page ${page + 1}/${totalPages}`);

    if (!pageItems.length) {
      console.log("No matches. Enter a new filter or 'q' to quit.");
    } else {
      pageItems.forEach((item, idx) => {
        const index = start + idx + 1;
        // highlight current
        const isSelected = item.model === currentModel && (item.provider === currentProvider || item.provider === "config");
        const prefix = isSelected ? "*" : " ";
        console.log(`${prefix}${index}. ${item.label}`);
      });
    }
    console.log("Enter number to select, text to filter, n/p for page, q to quit.");

    let answer = "";
    try {
      answer = await rl.question("models> ");
    } catch {
      return "Model picker closed.";
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
      state.llmModel = target.model;
      // Switch provider if it's a real provider (not just config listing)
      if (target.provider !== "config") {
        state.llmProvider = target.provider;
        await persistProviderSelection(target.provider as any, target.model, state.apiKeys[target.provider], process.cwd());
        return `Selected: ${target.model} (Provider switched to ${target.provider})`;
      } else {
        // Keeps current provider if just selecting from config list, unless we want to infer?
        // For now, just set model.
        return `Selected: ${target.model}`;
      }
    }

    currentFilter = trimmed;
    page = 0;
  }
}

async function fetchAllAvailableModels(
  config: Awaited<ReturnType<typeof loadConfig>>,
  state: { apiKeys?: Record<string, string> }
): Promise<Array<{ provider: string; model: string; label: string }>> {
  const providers = Object.keys(PROVIDER_API_INFO);
  const results: Array<{ provider: string; model: string; label: string }> = [];

  const checkProvider = async (provider: string) => {
    const creds = await getProviderCredential(provider, config, state);
    if (!creds) return; // Not configured

    const info = PROVIDER_API_INFO[provider];
    const endpoint = `${info.baseUrl.replace(/\/$/, "")}/models`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${creds.apiKey}`,
    };
    if (creds.headers) Object.assign(headers, creds.headers);
    if (provider === "claude") headers["anthropic-version"] = "2023-06-01";

    try {
      const res = await fetch(endpoint, { method: "GET", headers, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return; // Skip failed providers

      const data = (await res.json()) as Record<string, unknown>;
      const ids = extractModelIds(data);
      for (const id of ids) {
        results.push({
          provider,
          model: id,
          label: `[${info.name}] ${id}`,
        });
      }
    } catch {
      // Ignore connection errors
    }
  };

  await Promise.allSettled(providers.map(checkProvider));
  return results;
}

// Helper to get credentials for a specific provider
async function getProviderCredential(
  provider: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
  state: { apiKeys?: Record<string, string> }
): Promise<{ apiKey: string; headers?: Record<string, string> } | null> {
  const info = PROVIDER_API_INFO[provider];
  if (!info) return null;

  // 1. Session state
  if (state.apiKeys?.[provider]) {
    return { apiKey: state.apiKeys[provider], headers: config.llm?.headers };
  }

  // 2. Env var
  if (process.env[info.envVar]) {
    return { apiKey: process.env[info.envVar]!, headers: config.llm?.headers };
  }

  // 3. Special cases (OAuth or Ollama)
  if (provider === "openai") {
    const oauth = await getCredentials("openai-codex");
    if (oauth?.access_token) return { apiKey: oauth.access_token, headers: config.llm?.headers };
  }
  if (provider === "gemini") {
    const oauth = await getCredentials("google");
    if (oauth?.access_token) return { apiKey: oauth.access_token, headers: config.llm?.headers };
  }
  if (provider === "ollama") {
    return { apiKey: "ollama", headers: config.llm?.headers }; // config.llm?.baseUrl handles the URL
  }

  return null;
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
  state: { llmProvider?: string; apiKeys?: Record<string, string> },
): Promise<ModelListContext> {
  // If a provider is explicitly selected, try to get its credentials
  if (state.llmProvider && state.llmProvider !== "auto") {
    const creds = await getProviderCredential(state.llmProvider, config, state);
    const info = PROVIDER_API_INFO[state.llmProvider];

    if (creds && info) {
      return {
        kind: "openai-compatible",
        baseUrl: info.baseUrl, // Or config override? existing logic used fixed URLsMostly
        apiKey: creds.apiKey,
        headers: creds.headers,
        source: `provider:${state.llmProvider}`
      };
    }
    return { kind: "error", message: `Selected provider ${state.llmProvider} is not configured.` };
  }

  // Fallback to "auto" / default config logic (preserve existing behavior if needed, 
  // or just fail if no provider selected? 
  // The original function handled "auto" by checking various env vars one by one.
  // For simplicity and consistency, let's keep the config.llm fallback.)

  if (config.llm?.provider === "openai-compatible") {
    const apiKey = config.llm.apiKey ?? (config.llm.apiKeyEnv ? process.env[config.llm.apiKeyEnv] : process.env.OPENAI_API_KEY);
    if (apiKey) {
      return {
        kind: "openai-compatible",
        baseUrl: config.llm.baseUrl ?? "https://api.openai.com/v1",
        apiKey,
        headers: config.llm.headers,
        source: "config"
      };
    }
  }

  return { kind: "error", message: "No active provider selected or configured." };
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
