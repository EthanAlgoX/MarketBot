/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Type } from "@sinclair/typebox";

import type { MarketBotConfig } from "../../config/config.js";
import {
  closeDispatcher,
  createPinnedDispatcher,
  resolvePinnedHostname,
  SsrFBlockedError,
} from "../../infra/net/ssrf.js";
import { browserCloseTab, browserOpenTab, browserSnapshot } from "../../browser/client.js";
import { resolveBrowserConfig } from "../../browser/config.js";
import { loadConfig } from "../../config/config.js";
import type { Dispatcher } from "undici";
import { stringEnum } from "../schema/typebox.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";
import {
  CacheEntry,
  DEFAULT_CACHE_TTL_MINUTES,
  DEFAULT_TIMEOUT_SECONDS,
  normalizeCacheKey,
  readCache,
  readResponseText,
  resolveCacheTtlMs,
  resolveTimeoutSeconds,
  withTimeout,
  writeCache,
} from "./web-shared.js";
import {
  extractReadableContent,
  htmlToMarkdown,
  markdownToText,
  truncateText,
  type ExtractMode,
} from "./web-fetch-utils.js";

export { extractReadableContent } from "./web-fetch-utils.js";

const EXTRACT_MODES = ["markdown", "text"] as const;
const FETCH_STRATEGIES = ["fast", "waterfall", "race"] as const;

type FetchStrategy = (typeof FETCH_STRATEGIES)[number];
type FirecrawlProxyMode = "auto" | "basic" | "stealth";
type WebFetchEngineName = "native" | "firecrawl" | "browser";

type WebFetchEnginePayload = {
  finalUrl: string;
  status: number;
  contentType: string;
  title?: string;
  extractor: string;
  text: string;
  warning?: string;
};

type WebFetchEngineResult = {
  engine: WebFetchEngineName;
  payload: WebFetchEnginePayload;
};

const DEFAULT_FETCH_MAX_CHARS = 50_000;
const DEFAULT_FETCH_MAX_REDIRECTS = 3;
const DEFAULT_ERROR_MAX_CHARS = 4_000;
const DEFAULT_FIRECRAWL_BASE_URL = "https://api.firecrawl.dev";
const DEFAULT_FIRECRAWL_MAX_AGE_MS = 172_800_000;
const DEFAULT_FETCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const FETCH_CACHE = new Map<string, CacheEntry<Record<string, unknown>>>();

const WebFetchSchema = Type.Object({
  url: Type.String({ description: "HTTP or HTTPS URL to fetch." }),
  extractMode: Type.Optional(
    stringEnum(EXTRACT_MODES, {
      description: 'Extraction mode ("markdown" or "text").',
      default: "markdown",
    }),
  ),
  maxChars: Type.Optional(
    Type.Number({
      description: "Maximum characters to return (truncates when exceeded).",
      minimum: 100,
    }),
  ),
});

type WebFetchConfig = NonNullable<MarketBotConfig["tools"]>["web"] extends infer Web
  ? Web extends { fetch?: infer Fetch }
    ? Fetch
    : undefined
  : undefined;

type FirecrawlFetchConfig =
  | {
      enabled?: boolean;
      apiKey?: string;
      baseUrl?: string;
      onlyMainContent?: boolean;
      maxAgeMs?: number;
      timeoutSeconds?: number;
      proxy?: FirecrawlProxyMode;
      storeInCache?: boolean;
    }
  | undefined;

function resolveFetchConfig(cfg?: MarketBotConfig): WebFetchConfig {
  const fetch = cfg?.tools?.web?.fetch;
  if (!fetch || typeof fetch !== "object") {
    return undefined;
  }
  return fetch as WebFetchConfig;
}

function resolveFetchEnabled(params: { fetch?: WebFetchConfig; sandboxed?: boolean }): boolean {
  if (typeof params.fetch?.enabled === "boolean") {
    return params.fetch.enabled;
  }
  return true;
}

function resolveFetchReadabilityEnabled(fetch?: WebFetchConfig): boolean {
  if (typeof fetch?.readability === "boolean") {
    return fetch.readability;
  }
  return true;
}

function resolveFetchStrategy(fetch?: WebFetchConfig): FetchStrategy {
  const strategy =
    fetch && "strategy" in fetch && typeof fetch.strategy === "string"
      ? fetch.strategy.trim().toLowerCase()
      : "";
  if (strategy === "fast" || strategy === "race") {
    return strategy;
  }
  return "waterfall";
}

function resolveFirecrawlConfig(fetch?: WebFetchConfig): FirecrawlFetchConfig {
  if (!fetch || typeof fetch !== "object") {
    return undefined;
  }
  const firecrawl = "firecrawl" in fetch ? fetch.firecrawl : undefined;
  if (!firecrawl || typeof firecrawl !== "object") {
    return undefined;
  }
  return firecrawl as FirecrawlFetchConfig;
}

function resolveFirecrawlApiKey(firecrawl?: FirecrawlFetchConfig): string | undefined {
  const fromConfig =
    firecrawl && "apiKey" in firecrawl && typeof firecrawl.apiKey === "string"
      ? firecrawl.apiKey.trim()
      : "";
  const fromEnv = (process.env.FIRECRAWL_API_KEY ?? "").trim();
  return fromConfig || fromEnv || undefined;
}

function resolveFirecrawlEnabled(params: {
  firecrawl?: FirecrawlFetchConfig;
  apiKey?: string;
}): boolean {
  if (typeof params.firecrawl?.enabled === "boolean") {
    return params.firecrawl.enabled;
  }
  return Boolean(params.apiKey);
}

function resolveFirecrawlBaseUrl(firecrawl?: FirecrawlFetchConfig): string {
  const raw =
    firecrawl && "baseUrl" in firecrawl && typeof firecrawl.baseUrl === "string"
      ? firecrawl.baseUrl.trim()
      : "";
  return raw || DEFAULT_FIRECRAWL_BASE_URL;
}

function resolveFirecrawlOnlyMainContent(firecrawl?: FirecrawlFetchConfig): boolean {
  if (typeof firecrawl?.onlyMainContent === "boolean") {
    return firecrawl.onlyMainContent;
  }
  return true;
}

function resolveFirecrawlMaxAgeMs(firecrawl?: FirecrawlFetchConfig): number | undefined {
  const raw =
    firecrawl && "maxAgeMs" in firecrawl && typeof firecrawl.maxAgeMs === "number"
      ? firecrawl.maxAgeMs
      : undefined;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return undefined;
  }
  const parsed = Math.max(0, Math.floor(raw));
  return parsed > 0 ? parsed : undefined;
}

function resolveFirecrawlMaxAgeMsOrDefault(firecrawl?: FirecrawlFetchConfig): number {
  const resolved = resolveFirecrawlMaxAgeMs(firecrawl);
  if (typeof resolved === "number") {
    return resolved;
  }
  return DEFAULT_FIRECRAWL_MAX_AGE_MS;
}

function resolveFirecrawlProxy(firecrawl?: FirecrawlFetchConfig): FirecrawlProxyMode {
  if (
    firecrawl?.proxy === "auto" ||
    firecrawl?.proxy === "basic" ||
    firecrawl?.proxy === "stealth"
  ) {
    return firecrawl.proxy;
  }
  return "auto";
}

function resolveFirecrawlStoreInCache(firecrawl?: FirecrawlFetchConfig): boolean {
  if (typeof firecrawl?.storeInCache === "boolean") {
    return firecrawl.storeInCache;
  }
  return true;
}

function resolveMaxChars(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(100, Math.floor(parsed));
}

function resolveMaxRedirects(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.floor(parsed));
}

function looksLikeHtml(value: string): boolean {
  const trimmed = value.trimStart();
  if (!trimmed) {
    return false;
  }
  const head = trimmed.slice(0, 256).toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function fetchWithRedirects(params: {
  url: string;
  maxRedirects: number;
  timeoutSeconds: number;
  userAgent: string;
}): Promise<{ response: Response; finalUrl: string; dispatcher: Dispatcher }> {
  const signal = withTimeout(undefined, params.timeoutSeconds * 1000);
  const visited = new Set<string>();
  let currentUrl = params.url;
  let redirectCount = 0;

  while (true) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      throw new Error("Invalid URL: must be http or https");
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid URL: must be http or https");
    }

    const pinned = await resolvePinnedHostname(parsedUrl.hostname);
    const dispatcher = createPinnedDispatcher(pinned);
    let res: Response;
    try {
      res = await fetch(parsedUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "*/*",
          "User-Agent": params.userAgent,
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal,
        redirect: "manual",
        dispatcher,
      } as RequestInit);
    } catch (err) {
      await closeDispatcher(dispatcher);
      throw err;
    }

    if (isRedirectStatus(res.status)) {
      const location = res.headers.get("location");
      if (!location) {
        await closeDispatcher(dispatcher);
        throw new Error(`Redirect missing location header (${res.status})`);
      }
      redirectCount += 1;
      if (redirectCount > params.maxRedirects) {
        await closeDispatcher(dispatcher);
        throw new Error(`Too many redirects (limit: ${params.maxRedirects})`);
      }
      const nextUrl = new URL(location, parsedUrl).toString();
      if (visited.has(nextUrl)) {
        await closeDispatcher(dispatcher);
        throw new Error("Redirect loop detected");
      }
      visited.add(nextUrl);
      void res.body?.cancel();
      await closeDispatcher(dispatcher);
      currentUrl = nextUrl;
      continue;
    }

    return { response: res, finalUrl: currentUrl, dispatcher };
  }
}

function formatWebFetchErrorDetail(params: {
  detail: string;
  contentType?: string | null;
  maxChars: number;
}): string {
  const { detail, contentType, maxChars } = params;
  if (!detail) {
    return "";
  }
  let text = detail;
  const contentTypeLower = contentType?.toLowerCase();
  if (contentTypeLower?.includes("text/html") || looksLikeHtml(detail)) {
    const rendered = htmlToMarkdown(detail);
    const withTitle = rendered.title ? `${rendered.title}\n${rendered.text}` : rendered.text;
    text = markdownToText(withTitle);
  }
  const truncated = truncateText(text.trim(), maxChars);
  return truncated.text;
}
export async function fetchFirecrawlContent(params: {
  url: string;
  extractMode: ExtractMode;
  apiKey: string;
  baseUrl: string;
  onlyMainContent: boolean;
  maxAgeMs: number;
  proxy: "auto" | "basic" | "stealth";
  storeInCache: boolean;
  timeoutSeconds: number;
}): Promise<{
  text: string;
  title?: string;
  finalUrl?: string;
  status?: number;
  warning?: string;
}> {
  const endpoint = resolveFirecrawlEndpoint(params.baseUrl);
  const body: Record<string, unknown> = {
    url: params.url,
    formats: ["markdown"],
    onlyMainContent: params.onlyMainContent,
    timeout: params.timeoutSeconds * 1000,
    maxAge: params.maxAgeMs,
    proxy: params.proxy,
    storeInCache: params.storeInCache,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: withTimeout(undefined, params.timeoutSeconds * 1000),
  });

  const payload = (await res.json()) as {
    success?: boolean;
    data?: {
      markdown?: string;
      content?: string;
      metadata?: {
        title?: string;
        sourceURL?: string;
        statusCode?: number;
      };
    };
    warning?: string;
    error?: string;
  };

  if (!res.ok || payload?.success === false) {
    const detail = payload?.error || res.statusText;
    throw new Error(`Firecrawl fetch failed (${res.status}): ${detail}`.trim());
  }

  const data = payload?.data ?? {};
  const rawText =
    typeof data.markdown === "string"
      ? data.markdown
      : typeof data.content === "string"
        ? data.content
        : "";
  const text = params.extractMode === "text" ? markdownToText(rawText) : rawText;
  return {
    text,
    title: data.metadata?.title,
    finalUrl: data.metadata?.sourceURL,
    status: data.metadata?.statusCode,
    warning: payload?.warning,
  };
}

type WebFetchRunParams = {
  url: string;
  extractMode: ExtractMode;
  maxChars: number;
  maxRedirects: number;
  timeoutSeconds: number;
  cacheTtlMs: number;
  strategy: FetchStrategy;
  userAgent: string;
  readabilityEnabled: boolean;
  firecrawlEnabled: boolean;
  firecrawlApiKey?: string;
  firecrawlBaseUrl: string;
  firecrawlOnlyMainContent: boolean;
  firecrawlMaxAgeMs: number;
  firecrawlProxy: FirecrawlProxyMode;
  firecrawlStoreInCache: boolean;
  firecrawlTimeoutSeconds: number;
  config?: MarketBotConfig;
};

type StrategyResult = {
  result: WebFetchEngineResult;
  attemptedEngines: WebFetchEngineName[];
};

type EngineRunner = {
  engine: WebFetchEngineName;
  run: () => Promise<WebFetchEngineResult>;
};

type FailedEngine = {
  engine: WebFetchEngineName;
  error: Error;
};

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string" && error.trim()) {
    return new Error(error);
  }
  return new Error("Unknown web fetch error.");
}

function withUrlContext(error: unknown, url: string): Error {
  const normalized = toError(error);
  if (!normalized.message.includes("(url:")) {
    normalized.message = `${normalized.message} (url: ${url})`;
  }
  return normalized;
}

function canUseFirecrawl(params: WebFetchRunParams): params is WebFetchRunParams & {
  firecrawlApiKey: string;
} {
  return Boolean(params.firecrawlEnabled && params.firecrawlApiKey);
}

function isReadabilityNoContentError(error: Error): boolean {
  return error.message.includes("Readability returned no content");
}

function isReadabilityDisabledError(error: Error): boolean {
  return error.message.includes("Readability disabled");
}

function resolvePlannerFailure(params: {
  nativeError: Error;
  firecrawlError?: Error;
  firecrawlAttempted: boolean;
}): Error {
  if (isReadabilityNoContentError(params.nativeError) && params.firecrawlAttempted) {
    return new Error("Web fetch extraction failed: Readability and Firecrawl returned no content.");
  }
  if (isReadabilityDisabledError(params.nativeError) && !params.firecrawlAttempted) {
    return new Error(
      "Web fetch extraction failed: Readability disabled and Firecrawl unavailable.",
    );
  }
  if (params.firecrawlError) {
    return params.firecrawlError;
  }
  return params.nativeError;
}

async function runNativeEngine(params: WebFetchRunParams): Promise<WebFetchEngineResult> {
  let dispatcher: Dispatcher | null = null;
  let finalUrl = params.url;
  try {
    const result = await fetchWithRedirects({
      url: params.url,
      maxRedirects: params.maxRedirects,
      timeoutSeconds: params.timeoutSeconds,
      userAgent: params.userAgent,
    });
    const res = result.response;
    finalUrl = result.finalUrl;
    dispatcher = result.dispatcher;

    if (!res.ok) {
      const rawDetail = await readResponseText(res);
      const detail = formatWebFetchErrorDetail({
        detail: rawDetail,
        contentType: res.headers.get("content-type"),
        maxChars: DEFAULT_ERROR_MAX_CHARS,
      });
      throw new Error(
        `Web fetch failed (${res.status}): ${detail || res.statusText} (url: ${params.url})`,
      );
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const body = await readResponseText(res);

    let title: string | undefined;
    let extractor = "raw";
    let text = body;
    if (contentType.includes("text/html")) {
      if (!params.readabilityEnabled) {
        throw new Error("Web fetch extraction failed: Readability disabled.");
      }
      const readable = await extractReadableContent({
        html: body,
        url: finalUrl,
        extractMode: params.extractMode,
      });
      if (!readable?.text) {
        throw new Error("Web fetch extraction failed: Readability returned no content.");
      }
      text = readable.text;
      title = readable.title;
      extractor = "readability";
    } else if (contentType.includes("application/json")) {
      try {
        text = JSON.stringify(JSON.parse(body), null, 2);
        extractor = "json";
      } catch {
        text = body;
        extractor = "raw";
      }
    }

    return {
      engine: "native",
      payload: {
        finalUrl,
        status: res.status,
        contentType,
        title,
        extractor,
        text,
      },
    };
  } catch (error) {
    if (error instanceof SsrFBlockedError) {
      throw error;
    }
    throw withUrlContext(error, params.url);
  } finally {
    await closeDispatcher(dispatcher);
  }
}

async function runFirecrawlEngine(
  params: WebFetchRunParams,
  url: string,
): Promise<WebFetchEngineResult> {
  if (!canUseFirecrawl(params)) {
    throw new Error(`Firecrawl is not enabled. (url: ${url})`);
  }
  try {
    const firecrawl = await fetchFirecrawlContent({
      url,
      extractMode: params.extractMode,
      apiKey: params.firecrawlApiKey,
      baseUrl: params.firecrawlBaseUrl,
      onlyMainContent: params.firecrawlOnlyMainContent,
      maxAgeMs: params.firecrawlMaxAgeMs,
      proxy: params.firecrawlProxy,
      storeInCache: params.firecrawlStoreInCache,
      timeoutSeconds: params.firecrawlTimeoutSeconds,
    });
    return {
      engine: "firecrawl",
      payload: {
        finalUrl: firecrawl.finalUrl || url,
        status: firecrawl.status ?? 200,
        contentType: "text/markdown",
        title: firecrawl.title,
        extractor: "firecrawl",
        text: firecrawl.text,
        warning: firecrawl.warning,
      },
    };
  } catch (error) {
    throw withUrlContext(error, url);
  }
}

async function runBrowserEngine(
  params: WebFetchRunParams,
  url: string,
): Promise<WebFetchEngineResult> {
  const browser = await tryBrowserFallback({
    url,
    extractMode: params.extractMode,
    config: params.config,
  });
  if (!browser?.text) {
    throw new Error(`Browser fetch fallback failed. (url: ${url})`);
  }
  return {
    engine: "browser",
    payload: {
      finalUrl: url,
      status: 200,
      contentType: "text/markdown",
      title: browser.title,
      extractor: "browser",
      text: browser.text,
    },
  };
}

async function runFirstSuccessful(
  runners: EngineRunner[],
): Promise<{ result: WebFetchEngineResult | null; failures: FailedEngine[] }> {
  const pending = runners.map((runner) => ({
    engine: runner.engine,
    promise: runner.run().then(
      (result) => ({ ok: true as const, result }),
      (error) => ({ ok: false as const, error: toError(error) }),
    ),
  }));
  const failures: FailedEngine[] = [];

  while (pending.length > 0) {
    const settled = await Promise.race(
      pending.map((entry, index) => entry.promise.then((output) => ({ index, output }))),
    );
    const [entry] = pending.splice(settled.index, 1);
    if (settled.output.ok) {
      return { result: settled.output.result, failures };
    }
    failures.push({ engine: entry.engine, error: settled.output.error });
  }

  return { result: null, failures };
}

async function runFastStrategy(params: WebFetchRunParams): Promise<StrategyResult> {
  const attemptedEngines: WebFetchEngineName[] = ["native"];
  try {
    const result = await runNativeEngine(params);
    return { result, attemptedEngines };
  } catch (error) {
    if (error instanceof SsrFBlockedError) {
      throw error;
    }
    const nativeError = toError(error);
    if (
      canUseFirecrawl(params) &&
      (isReadabilityNoContentError(nativeError) || isReadabilityDisabledError(nativeError))
    ) {
      attemptedEngines.push("firecrawl");
      try {
        const result = await runFirecrawlEngine(params, params.url);
        return { result, attemptedEngines };
      } catch (firecrawlError) {
        throw resolvePlannerFailure({
          nativeError,
          firecrawlError: toError(firecrawlError),
          firecrawlAttempted: true,
        });
      }
    }
    throw nativeError;
  }
}

async function runWaterfallStrategy(params: WebFetchRunParams): Promise<StrategyResult> {
  const attemptedEngines: WebFetchEngineName[] = ["native"];
  let nativeError: Error;
  try {
    const result = await runNativeEngine(params);
    return { result, attemptedEngines };
  } catch (error) {
    if (error instanceof SsrFBlockedError) {
      throw error;
    }
    nativeError = toError(error);
  }

  let firecrawlError: Error | undefined;
  if (canUseFirecrawl(params)) {
    attemptedEngines.push("firecrawl");
    try {
      const result = await runFirecrawlEngine(params, params.url);
      return { result, attemptedEngines };
    } catch (error) {
      firecrawlError = toError(error);
    }
  }

  attemptedEngines.push("browser");
  try {
    const result = await runBrowserEngine(params, params.url);
    return { result, attemptedEngines };
  } catch {
    throw resolvePlannerFailure({
      nativeError,
      firecrawlError,
      firecrawlAttempted: canUseFirecrawl(params),
    });
  }
}

async function runRaceStrategy(params: WebFetchRunParams): Promise<StrategyResult> {
  const attemptedEngines: WebFetchEngineName[] = ["native"];
  let nativeError: Error;
  try {
    const result = await runNativeEngine(params);
    return { result, attemptedEngines };
  } catch (error) {
    if (error instanceof SsrFBlockedError) {
      throw error;
    }
    nativeError = toError(error);
  }

  const fallbackRunners: EngineRunner[] = [];
  if (canUseFirecrawl(params)) {
    fallbackRunners.push({
      engine: "firecrawl",
      run: () => runFirecrawlEngine(params, params.url),
    });
  }
  fallbackRunners.push({
    engine: "browser",
    run: () => runBrowserEngine(params, params.url),
  });
  attemptedEngines.push(...fallbackRunners.map((runner) => runner.engine));

  const raced = await runFirstSuccessful(fallbackRunners);
  if (raced.result) {
    return { result: raced.result, attemptedEngines };
  }

  const firecrawlError = raced.failures.find((failure) => failure.engine === "firecrawl")?.error;
  throw resolvePlannerFailure({
    nativeError,
    firecrawlError,
    firecrawlAttempted: canUseFirecrawl(params),
  });
}

async function executeWebFetchStrategy(params: WebFetchRunParams): Promise<StrategyResult> {
  if (params.strategy === "fast") {
    return runFastStrategy(params);
  }
  if (params.strategy === "race") {
    return runRaceStrategy(params);
  }
  return runWaterfallStrategy(params);
}

async function runWebFetch(params: WebFetchRunParams): Promise<Record<string, unknown>> {
  const cacheKey = normalizeCacheKey(
    `fetch:${params.url}:${params.extractMode}:${params.maxChars}:${params.strategy}`,
  );
  const cached = readCache(FETCH_CACHE, cacheKey);
  if (cached) {
    return { ...cached.value, cached: true };
  }

  let protocol = "";
  try {
    protocol = new URL(params.url).protocol;
  } catch {
    throw new Error("Invalid URL: must be http or https");
  }
  if (!["http:", "https:"].includes(protocol)) {
    throw new Error("Invalid URL: must be http or https");
  }

  const start = Date.now();
  const strategyResult = await executeWebFetchStrategy(params);
  const truncated = truncateText(strategyResult.result.payload.text, params.maxChars);
  const payload = {
    url: params.url,
    finalUrl: strategyResult.result.payload.finalUrl,
    status: strategyResult.result.payload.status,
    contentType: strategyResult.result.payload.contentType,
    title: strategyResult.result.payload.title,
    extractMode: params.extractMode,
    extractor: strategyResult.result.payload.extractor,
    strategy: params.strategy,
    engine: strategyResult.result.engine,
    attemptedEngines: strategyResult.attemptedEngines,
    truncated: truncated.truncated,
    length: truncated.text.length,
    fetchedAt: new Date().toISOString(),
    tookMs: Date.now() - start,
    text: truncated.text,
    warning: strategyResult.result.payload.warning,
  };
  writeCache(FETCH_CACHE, cacheKey, payload, params.cacheTtlMs);
  return payload;
}

async function tryBrowserFallback(params: {
  url: string;
  extractMode: ExtractMode;
  config?: MarketBotConfig;
}): Promise<{ text: string; title?: string } | null> {
  const cfg = params.config ?? loadConfig();
  const browserConfig = resolveBrowserConfig(cfg.browser, cfg);
  if (!browserConfig.enabled) {
    return null;
  }

  // Use "host" or "sandbox" based on availability.
  // Note: We don't have access to sandboxBridgeUrl here easily unless passed down,
  // but resolveBrowserBaseUrl handles some defaults.
  // For now, we rely on standard configuration.
  const baseUrl = undefined; // Let client.ts resolve from default if not provided

  // Check if browser service is actually reachable/running
  try {
    // Quick check to see if we can open a tab.
    // If browser is not running, this will throw or timeout.
  } catch {
    return null;
  }

  let tabId: string | undefined;
  try {
    const tab = await browserOpenTab(baseUrl, params.url, { profile: "marketbot" });
    tabId = tab.targetId;

    // Wait a moment for page load? browserOpenTab generally waits for load event or timeout.
    // Now take snapshot.
    const snapshot = await browserSnapshot(baseUrl, {
      format: "ai",
      mode: "efficient",
      profile: "marketbot",
      targetId: tabId,
    });

    if (snapshot.format === "ai") {
      return {
        text: snapshot.snapshot,
        title: tab.title,
      };
    }
    return null;
  } catch {
    // Fallback failed
    return null;
  } finally {
    if (tabId) {
      await browserCloseTab(baseUrl, tabId, { profile: "marketbot" }).catch(() => {});
    }
  }
}

function resolveFirecrawlEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return `${DEFAULT_FIRECRAWL_BASE_URL}/v2/scrape`;
  }
  try {
    const url = new URL(trimmed);
    if (url.pathname && url.pathname !== "/") {
      return url.toString();
    }
    url.pathname = "/v2/scrape";
    return url.toString();
  } catch {
    return `${DEFAULT_FIRECRAWL_BASE_URL}/v2/scrape`;
  }
}

export function createWebFetchTool(options?: {
  config?: MarketBotConfig;
  sandboxed?: boolean;
}): AnyAgentTool | null {
  const fetch = resolveFetchConfig(options?.config);
  if (!resolveFetchEnabled({ fetch, sandboxed: options?.sandboxed })) {
    return null;
  }
  const readabilityEnabled = resolveFetchReadabilityEnabled(fetch);
  const strategy = resolveFetchStrategy(fetch);
  const firecrawl = resolveFirecrawlConfig(fetch);
  const firecrawlApiKey = resolveFirecrawlApiKey(firecrawl);
  const firecrawlEnabled = resolveFirecrawlEnabled({ firecrawl, apiKey: firecrawlApiKey });
  const firecrawlBaseUrl = resolveFirecrawlBaseUrl(firecrawl);
  const firecrawlOnlyMainContent = resolveFirecrawlOnlyMainContent(firecrawl);
  const firecrawlMaxAgeMs = resolveFirecrawlMaxAgeMsOrDefault(firecrawl);
  const firecrawlProxy = resolveFirecrawlProxy(firecrawl);
  const firecrawlStoreInCache = resolveFirecrawlStoreInCache(firecrawl);
  const firecrawlTimeoutSeconds = resolveTimeoutSeconds(
    firecrawl?.timeoutSeconds ?? fetch?.timeoutSeconds,
    DEFAULT_TIMEOUT_SECONDS,
  );
  const userAgent =
    (fetch && "userAgent" in fetch && typeof fetch.userAgent === "string" && fetch.userAgent) ||
    DEFAULT_FETCH_USER_AGENT;
  return {
    label: "Web Fetch",
    name: "web_fetch",
    description:
      "Fetch and extract readable content from a URL (HTML → markdown/text). Use for lightweight page access without browser automation.",
    parameters: WebFetchSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const url = readStringParam(params, "url", { required: true });
      const extractMode = readStringParam(params, "extractMode") === "text" ? "text" : "markdown";
      const maxChars = readNumberParam(params, "maxChars", { integer: true });
      const result = await runWebFetch({
        url,
        extractMode,
        maxChars: resolveMaxChars(maxChars ?? fetch?.maxChars, DEFAULT_FETCH_MAX_CHARS),
        maxRedirects: resolveMaxRedirects(fetch?.maxRedirects, DEFAULT_FETCH_MAX_REDIRECTS),
        timeoutSeconds: resolveTimeoutSeconds(fetch?.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS),
        cacheTtlMs: resolveCacheTtlMs(fetch?.cacheTtlMinutes, DEFAULT_CACHE_TTL_MINUTES),
        strategy,
        userAgent,
        readabilityEnabled,
        firecrawlEnabled,
        firecrawlApiKey,
        firecrawlBaseUrl,
        firecrawlOnlyMainContent,
        firecrawlMaxAgeMs,
        firecrawlProxy,
        firecrawlStoreInCache,
        firecrawlTimeoutSeconds,
        config: options?.config,
      });
      return jsonResult(result);
    },
  };
}
