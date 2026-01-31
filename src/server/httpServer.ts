import http from "node:http";

import { renderGuiPage } from "./guiPage.js";

import type { MarketBotConfig } from "../config/types.js";
import { loadConfig } from "../config/io.js";
import {
  createOpenAiOAuthSession,
  exchangeOpenAiOAuthCode,
  getCredentials,
  logout,
  storeCredentials,
  waitForOpenAiOAuthCallback,
} from "../core/auth/oauth.js";
import { createProviderFromConfigAsync } from "../core/providers/registry.js";
import { runMarketBot } from "../core/pipeline.js";
import { getMarketDataFromIntent, type MarketDataServiceOptions } from "../data/marketDataService.js";
import { resolveDefaultAgentId } from "../agents/agentScope.js";
import { SessionStore } from "../session/store.js";
import { buildToolContext } from "../tools/context.js";
import { createDefaultToolRegistry } from "../tools/registry.js";
import { isToolAllowed, resolveToolPolicy } from "../tools/policy.js";
import { appendToolLog } from "../tools/toolLogging.js";

export interface HttpServerOptions {
  host?: string;
  port?: number;
  enableGui?: boolean;
}

export async function startHttpServer(options: HttpServerOptions = {}): Promise<http.Server> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const enableGui = options.enableGui ?? false;
  const openAiSessions = new Map<string, { verifier: string; redirectUri: string; createdAt: number }>();
  const openAiSessionTtlMs = 5 * 60 * 1000;

  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        return sendJson(res, 400, { ok: false, error: "Missing URL" });
      }

      if (req.method === "GET" && req.url === "/health") {
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === "POST" && req.url === "/auth/openai/start") {
        const hasCustomConfig = Boolean(
          process.env.OPENAI_OAUTH_CLIENT_ID || process.env.OPENAI_OAUTH_REDIRECT_URI,
        );
        const redirectUri = hasCustomConfig
          ? process.env.OPENAI_OAUTH_REDIRECT_URI ??
            `http://${req.headers.host || `${host}:${port}`}/auth/openai/callback`
          : undefined;
        const session = createOpenAiOAuthSession(redirectUri ? { redirectUri } : undefined);

        if (hasCustomConfig) {
          openAiSessions.set(session.state, {
            verifier: session.verifier,
            redirectUri: session.redirectUri,
            createdAt: Date.now(),
          });
        } else {
          void waitForOpenAiOAuthCallback({
            state: session.state,
            verifier: session.verifier,
            redirectUri: session.redirectUri,
          })
            .then((creds) => storeCredentials("openai-codex", creds))
            .catch((err) => {
              console.error("OpenAI OAuth callback failed:", err);
            });
        }

        return sendJson(res, 200, { ok: true, authUrl: session.authUrl });
      }

      if (req.method === "GET" && req.url.startsWith("/auth/openai/callback")) {
        const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(`<h1>Authentication failed</h1><p>${error}</p>`);
          return;
        }

        if (!code || !state) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end("<h1>Authentication failed</h1><p>Missing code/state.</p>");
          return;
        }

        const session = openAiSessions.get(state);
        if (!session) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end("<h1>Authentication failed</h1><p>Invalid or expired session.</p>");
          return;
        }

        if (Date.now() - session.createdAt > openAiSessionTtlMs) {
          openAiSessions.delete(state);
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end("<h1>Authentication failed</h1><p>Session expired. Please retry.</p>");
          return;
        }

        const creds = await exchangeOpenAiOAuthCode({
          code,
          verifier: session.verifier,
          redirectUri: session.redirectUri,
        });
        await storeCredentials("openai-codex", creds);
        openAiSessions.delete(state);

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end("<h1>Authenticated!</h1><p>You can close this window now.</p>");
        return;
      }

      if (req.method === "GET" && req.url === "/auth/openai/status") {
        const creds = await getCredentials("openai-codex");
        return sendJson(res, 200, {
          ok: true,
          authenticated: Boolean(creds?.access_token),
          expiresAt: creds?.expires_at ?? null,
        });
      }

      if (req.method === "POST" && req.url === "/auth/openai/logout") {
        await logout("openai-codex");
        return sendJson(res, 200, { ok: true });
      }

      if (enableGui && req.method === "GET" && req.url === "/") {
        const html = renderGuiPage({ baseUrl: `http://${host}:${port}` });
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
        return;
      }

      if (req.method === "POST" && req.url === "/analyze") {
        const body = await readJsonBody(req);
        if (!body || typeof body.query !== "string" || !body.query.trim()) {
          return sendJson(res, 400, { ok: false, error: "Missing query" });
        }

        const config = await loadConfig(process.cwd(), { validate: true });
        const llmOverride = extractLlmOverride(body);
        if (llmOverride) {
          config.llm = { ...(config.llm ?? {}), ...llmOverride };
        }
        const provider = await createProviderFromConfigAsync(config);
        const agentId = (body.agentId as string | undefined)?.trim() || resolveDefaultAgentId(config);

        const dataOptions = resolveDataOptions(body);
        const sessionEnabled = config.sessions?.enabled !== false;
        const sessionKey = (body.sessionKey as string | undefined)?.trim() || `agent:${agentId}:main`;
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
          userQuery: body.query.trim(),
          dataOptions,
          agentId,
          provider,
          dataService: { getMarketDataFromIntent },
          includeTrace: Boolean(body.includeTrace),
          session: sessionStore
            ? {
              key: sessionKey,
              store: sessionStore,
              includeContext: config.sessions?.includeContext,
            }
            : undefined,
        });

        return sendJson(res, 200, { ok: true, data: outputs });
      }

      if (req.method === "POST" && req.url === "/tools/invoke") {
        const body = await readJsonBody(req);
        if (!body) {
          return sendJson(res, 400, { ok: false, error: "Missing request body" });
        }
        const toolName = typeof body.name === "string" ? body.name.trim() : "";
        if (!toolName) {
          return sendJson(res, 400, { ok: false, error: "Missing tool name" });
        }

        const registry = createDefaultToolRegistry();
        const tool = registry.get(toolName);
        if (!tool) {
          return sendJson(res, 404, { ok: false, error: `Tool not found: ${toolName}` });
        }

        const config = await loadConfig(process.cwd());
        const agentId = typeof body.agentId === "string" ? body.agentId.trim() : undefined;
        const allTools = registry.list().map((entry) => entry.name);
        const policy = resolveToolPolicy(config, agentId);
        if (!isToolAllowed(tool.name, policy, allTools)) {
          return sendJson(res, 403, { ok: false, error: `Tool not allowed: ${tool.name}` });
        }

        const rawArgs = typeof body.rawArgs === "string"
          ? body.rawArgs
          : Array.isArray(body.args)
            ? body.args.join(" ")
            : "";
        const context = buildToolContext(rawArgs, process.cwd(), agentId);
        const startedAt = Date.now();
        const result = await tool.run(context);
        await appendToolLog({
          name: tool.name,
          ok: result.ok,
          durationMs: Date.now() - startedAt,
          input: rawArgs,
          output: result.output,
        }, context);
        return sendJson(res, 200, { ok: result.ok, result });
      }

      return sendJson(res, 404, { ok: false, error: "Not found" });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: toErrorMessage(err) });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      resolve(server);
    });
  });
}

function extractLlmOverride(body: Record<string, unknown>): Partial<NonNullable<MarketBotConfig["llm"]>> | null {
  if (!body.llm || typeof body.llm !== "object") return null;
  const raw = body.llm as Record<string, unknown>;
  const allowedProvider = raw.provider === "openai-compatible" ? raw.provider : undefined;
  const model = typeof raw.model === "string" ? raw.model.trim() : undefined;
  const baseUrl = typeof raw.baseUrl === "string" ? raw.baseUrl.trim() : undefined;
  const apiKey = typeof raw.apiKey === "string" ? raw.apiKey.trim() : undefined;
  const apiKeyEnv = typeof raw.apiKeyEnv === "string" ? raw.apiKeyEnv.trim() : undefined;
  const jsonMode = typeof raw.jsonMode === "boolean" ? raw.jsonMode : undefined;
  const timeoutMs =
    typeof raw.timeoutMs === "number" && Number.isFinite(raw.timeoutMs) ? Math.max(1000, raw.timeoutMs) : undefined;
  const headers =
    raw.headers && typeof raw.headers === "object" && !Array.isArray(raw.headers)
      ? Object.fromEntries(
        Object.entries(raw.headers).filter((entry) => typeof entry[1] === "string"),
      )
      : undefined;

  const result: Partial<NonNullable<MarketBotConfig["llm"]>> = {};
  if (allowedProvider) result.provider = allowedProvider;
  if (model) result.model = model;
  if (baseUrl) result.baseUrl = baseUrl;
  if (apiKey) result.apiKey = apiKey;
  if (apiKeyEnv) result.apiKeyEnv = apiKeyEnv;
  if (jsonMode !== undefined) result.jsonMode = jsonMode;
  if (timeoutMs !== undefined) result.timeoutMs = timeoutMs;
  if (headers && Object.keys(headers).length) result.headers = headers as Record<string, string>;

  return Object.keys(result).length ? result : null;
}

function resolveDataOptions(body: Record<string, unknown>): MarketDataServiceOptions | undefined {
  if (body.dataOptions && typeof body.dataOptions === "object") {
    return body.dataOptions as MarketDataServiceOptions;
  }

  const mode = typeof body.mode === "string" ? body.mode : undefined;
  const search = Boolean(body.search);
  const scrape = Boolean(body.scrape);
  const enableSearch = search || scrape ? true : undefined;
  const selectedMode = mode ?? (scrape ? "scrape" : undefined);

  if (!selectedMode && !enableSearch) return undefined;
  return {
    mode: selectedMode as MarketDataServiceOptions["mode"],
    enableSearch,
  };
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload, null, 2);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(body);
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown> | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
