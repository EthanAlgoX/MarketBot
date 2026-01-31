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

export type RelaySmokeTest = "qr";

export function parseRelaySmokeTest(args: string[], env: NodeJS.ProcessEnv): RelaySmokeTest | null {
  const smokeIdx = args.indexOf("--smoke");
  if (smokeIdx !== -1) {
    const value = args[smokeIdx + 1];
    if (!value || value.startsWith("-")) {
      throw new Error("Missing value for --smoke (expected: qr)");
    }
    if (value === "qr") {
      return "qr";
    }
    throw new Error(`Unknown smoke test: ${value}`);
  }

  if (args.includes("--smoke-qr")) {
    return "qr";
  }

  // Back-compat: only run env-based smoke mode when no CLI args are present,
  // to avoid surprising early-exit when users set env vars globally.
  if (args.length === 0 && (env.MARKETBOT_SMOKE_QR === "1" || env.MARKETBOT_SMOKE === "qr")) {
    return "qr";
  }

  return null;
}

export async function runRelaySmokeTest(test: RelaySmokeTest): Promise<void> {
  switch (test) {
    case "qr": {
      const { renderQrPngBase64 } = await import("../web/qr-image.js");
      await renderQrPngBase64("smoke-test");
      return;
    }
  }
}
