/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import {
  browserCloseTab,
  browserFocusTab,
  browserOpenTab,
  browserStart,
  browserStatus,
  browserTabs,
} from "../browser/client.js";
import { evaluateJavaScript, fetchMainResponseBodyViaCdp } from "../browser/cdp.js";
import { resolveBrowserConfig } from "../browser/config.js";
import { loadConfig } from "../config/config.js";

export type BrowserFetchOptions = {
  profile?: string;
  maxChars?: number;
  retryMaxChars?: number;
  content?: "text" | "html";
};

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function coerceStringValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

async function waitForDocumentReady(wsUrl: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await evaluateJavaScript({
        wsUrl,
        expression: "document.readyState",
        awaitPromise: false,
        returnByValue: true,
      });
      const state = coerceStringValue(res.result?.value);
      if (state === "complete" || state === "interactive") {
        return;
      }
    } catch {
      // ignore and retry
    }
    await sleep(200);
  }
}

async function fetchContentViaCdp(opts: {
  wsUrl: string;
  fallbackWsUrl?: string;
  content: "text" | "html";
  maxChars: number;
  url: string;
}): Promise<{ text: string; truncated: boolean }> {
  try {
    const tryFetch = async (wsUrl: string) =>
      await fetchMainResponseBodyViaCdp({
        wsUrl,
        url: opts.url,
        timeoutMs: 15000,
      });

    let raw = await tryFetch(opts.wsUrl);
    if (!raw && opts.fallbackWsUrl) {
      raw = await tryFetch(opts.fallbackWsUrl);
    }
    if (!raw) {
      return { text: "", truncated: false };
    }
    if (raw.length <= opts.maxChars) {
      return { text: raw, truncated: false };
    }
    return { text: raw.slice(0, opts.maxChars), truncated: true };
  } catch {
    if (opts.fallbackWsUrl) {
      try {
        const raw = await fetchMainResponseBodyViaCdp({
          wsUrl: opts.fallbackWsUrl,
          url: opts.url,
          timeoutMs: 15000,
        });
        if (raw) {
          if (raw.length <= opts.maxChars) {
            return { text: raw, truncated: false };
          }
          return { text: raw.slice(0, opts.maxChars), truncated: true };
        }
      } catch {
        // ignore and fall through
      }
    }
    // Fallback: DOM extraction. This can be empty for downloads (e.g. CSV),
    // but can still help for HTML pages when network body is inaccessible.
    await waitForDocumentReady(opts.wsUrl, 8000);
    const expression =
      opts.content === "html"
        ? "document.documentElement ? document.documentElement.outerHTML : ''"
        : "(document.body ? document.body.innerText : document.documentElement ? document.documentElement.innerText : '')";
    const res = await evaluateJavaScript({
      wsUrl: opts.wsUrl,
      expression,
      awaitPromise: false,
      returnByValue: true,
    });
    const raw = coerceStringValue(res.result?.value);
    if (!raw) {
      return { text: "", truncated: false };
    }
    if (raw.length <= opts.maxChars) {
      return { text: raw, truncated: false };
    }
    return { text: raw.slice(0, opts.maxChars), truncated: true };
  }
}

async function pruneNoisyTabs(profile?: string) {
  // The managed "marketbot" browser profile can accumulate tabs from prior runs/tests.
  // Keeping a stable, mostly-blank tab set avoids confusing UX (e.g. focusing a stale Example Domain tab).
  const tabs = await browserTabs(undefined, { profile }).catch(() => []);
  if (tabs.length === 0) {
    return;
  }

  let keptBlank = 0;
  const toClose: string[] = [];
  for (const tab of tabs) {
    const url = tab.url?.trim() ?? "";
    // Tests and some Chrome builds can leave "Example Domain" tabs around. Those are
    // unhelpful for finance fetch flows and can confuse "last active tab" behavior.
    if (/^https?:\/\/example\.com(?:\/|$)/i.test(url)) {
      toClose.push(tab.targetId);
      continue;
    }
    if (url === "about:blank") {
      keptBlank += 1;
      if (keptBlank > 2) {
        toClose.push(tab.targetId);
      }
    }
  }

  for (const targetId of toClose.slice(0, 20)) {
    await browserCloseTab(undefined, targetId, { profile }).catch(() => undefined);
  }

  // Best-effort: focus a remaining tab so the UI doesn't snap back to a stale page.
  const remaining = await browserTabs(undefined, { profile }).catch(() => []);
  const preferred = remaining.find((t) => t.url === "about:blank") ?? remaining.at(0);
  if (preferred) {
    await browserFocusTab(undefined, preferred.targetId, { profile }).catch(() => undefined);
  }
}

export async function fetchTextWithBrowser(url: string, opts: BrowserFetchOptions = {}) {
  const root = loadConfig();
  const cfg = resolveBrowserConfig(root.browser, root);
  if (!cfg.enabled) {
    throw new Error("Browser control is disabled (browser.enabled=false)");
  }
  const profile = opts.profile;
  const status = await browserStatus(undefined, { profile });
  if (!status.running) {
    await browserStart(undefined, { profile });
  }

  await pruneNoisyTabs(profile);
  const tab = await browserOpenTab(undefined, url, { profile });
  try {
    const maxChars = opts.maxChars ?? 200000;
    const content = opts.content ?? "text";
    const tabs = await browserTabs(undefined, { profile }).catch(() => []);
    const wsUrl = tab.wsUrl || tabs.find((t) => t.targetId === tab.targetId)?.wsUrl;
    const fallbackWsUrl = tabs.find((t) => t.targetId !== tab.targetId && t.wsUrl)?.wsUrl;

    if (!wsUrl) {
      throw new Error("Browser tab is missing wsUrl; can't fetch content via CDP");
    }

    const cdp = await fetchContentViaCdp({ wsUrl, fallbackWsUrl, content, maxChars, url });
    if (cdp.truncated && opts.retryMaxChars) {
      const retry = await fetchContentViaCdp({
        wsUrl,
        fallbackWsUrl,
        content,
        maxChars: opts.retryMaxChars,
        url,
      });
      return { text: retry.text, url: tab.url, truncated: retry.truncated };
    }
    return { text: cdp.text, url: tab.url, truncated: cdp.truncated };
  } finally {
    await browserCloseTab(undefined, tab.targetId, { profile }).catch(() => undefined);
  }
}
