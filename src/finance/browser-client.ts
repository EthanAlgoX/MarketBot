/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import {
  browserCloseTab,
  browserOpenTab,
  browserSnapshot,
  browserStart,
  browserStatus,
} from "../browser/client.js";
import { resolveBrowserConfig } from "../browser/config.js";
import { loadConfig } from "../config/config.js";

export type BrowserFetchOptions = {
  profile?: string;
  maxChars?: number;
  retryMaxChars?: number;
};

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

  const tab = await browserOpenTab(undefined, url, { profile });
  try {
    const snapshot = await browserSnapshot(undefined, {
      format: "ai",
      targetId: tab.targetId,
      maxChars: opts.maxChars ?? 200000,
      profile,
    });
    if (snapshot.format !== "ai") {
      throw new Error("Unexpected browser snapshot format");
    }
    if (snapshot.truncated && opts.retryMaxChars) {
      const retry = await browserSnapshot(undefined, {
        format: "ai",
        targetId: tab.targetId,
        maxChars: opts.retryMaxChars,
        profile,
      });
      if (retry.format !== "ai") {
        throw new Error("Unexpected browser snapshot format");
      }
      return { text: retry.snapshot, url: retry.url, truncated: retry.truncated };
    }
    return { text: snapshot.snapshot, url: snapshot.url, truncated: snapshot.truncated };
  } finally {
    await browserCloseTab(undefined, tab.targetId, { profile }).catch(() => undefined);
  }
}
