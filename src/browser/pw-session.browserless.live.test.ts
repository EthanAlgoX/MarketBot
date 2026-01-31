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

import { describe, it } from "vitest";
import { isTruthyEnvValue } from "../infra/env.js";

const LIVE =
  isTruthyEnvValue(process.env.LIVE) || isTruthyEnvValue(process.env.MARKETBOT_LIVE_TEST);
const CDP_URL = process.env.MARKETBOT_LIVE_BROWSER_CDP_URL?.trim() || "";
const describeLive = LIVE && CDP_URL ? describe : describe.skip;

async function waitFor(
  fn: () => Promise<boolean>,
  opts: { timeoutMs: number; intervalMs: number },
): Promise<void> {
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) {
      return;
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs));
  }
  throw new Error("timed out");
}

describeLive("browser (live): remote CDP tab persistence", () => {
  it("creates, lists, focuses, and closes tabs via Playwright", { timeout: 60_000 }, async () => {
    const pw = await import("./pw-ai.js");
    await pw.closePlaywrightBrowserConnection().catch(() => {});

    const created = await pw.createPageViaPlaywright({ cdpUrl: CDP_URL, url: "about:blank" });
    try {
      await waitFor(
        async () => {
          const pages = await pw.listPagesViaPlaywright({ cdpUrl: CDP_URL });
          return pages.some((p) => p.targetId === created.targetId);
        },
        { timeoutMs: 10_000, intervalMs: 250 },
      );

      await pw.focusPageByTargetIdViaPlaywright({ cdpUrl: CDP_URL, targetId: created.targetId });

      await pw.closePageByTargetIdViaPlaywright({ cdpUrl: CDP_URL, targetId: created.targetId });

      await waitFor(
        async () => {
          const pages = await pw.listPagesViaPlaywright({ cdpUrl: CDP_URL });
          return !pages.some((p) => p.targetId === created.targetId);
        },
        { timeoutMs: 10_000, intervalMs: 250 },
      );
    } finally {
      await pw.closePlaywrightBrowserConnection().catch(() => {});
    }
  });
});
