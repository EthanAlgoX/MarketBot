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

import { detectBinary } from "../commands/onboard-helpers.js";
import { loadConfig } from "../config/config.js";
import { runCommandWithTimeout } from "../process/exec.js";
import type { RuntimeEnv } from "../runtime.js";
import { createIMessageRpcClient } from "./client.js";

export type IMessageProbe = {
  ok: boolean;
  error?: string | null;
  fatal?: boolean;
};

export type IMessageProbeOptions = {
  cliPath?: string;
  dbPath?: string;
  runtime?: RuntimeEnv;
};

type RpcSupportResult = {
  supported: boolean;
  error?: string;
  fatal?: boolean;
};

const rpcSupportCache = new Map<string, RpcSupportResult>();

async function probeRpcSupport(cliPath: string): Promise<RpcSupportResult> {
  const cached = rpcSupportCache.get(cliPath);
  if (cached) {
    return cached;
  }
  try {
    const result = await runCommandWithTimeout([cliPath, "rpc", "--help"], { timeoutMs: 2000 });
    const combined = `${result.stdout}\n${result.stderr}`.trim();
    const normalized = combined.toLowerCase();
    if (normalized.includes("unknown command") && normalized.includes("rpc")) {
      const fatal = {
        supported: false,
        fatal: true,
        error: 'imsg CLI does not support the "rpc" subcommand (update imsg)',
      };
      rpcSupportCache.set(cliPath, fatal);
      return fatal;
    }
    if (result.code === 0) {
      const supported = { supported: true };
      rpcSupportCache.set(cliPath, supported);
      return supported;
    }
    return {
      supported: false,
      error: combined || `imsg rpc --help failed (code ${String(result.code ?? "unknown")})`,
    };
  } catch (err) {
    return { supported: false, error: String(err) };
  }
}

export async function probeIMessage(
  timeoutMs = 2000,
  opts: IMessageProbeOptions = {},
): Promise<IMessageProbe> {
  const cfg = opts.cliPath || opts.dbPath ? undefined : loadConfig();
  const cliPath = opts.cliPath?.trim() || cfg?.channels?.imessage?.cliPath?.trim() || "imsg";
  const dbPath = opts.dbPath?.trim() || cfg?.channels?.imessage?.dbPath?.trim();
  const detected = await detectBinary(cliPath);
  if (!detected) {
    return { ok: false, error: `imsg not found (${cliPath})` };
  }

  const rpcSupport = await probeRpcSupport(cliPath);
  if (!rpcSupport.supported) {
    return {
      ok: false,
      error: rpcSupport.error ?? "imsg rpc unavailable",
      fatal: rpcSupport.fatal,
    };
  }

  const client = await createIMessageRpcClient({
    cliPath,
    dbPath,
    runtime: opts.runtime,
  });
  try {
    await client.request("chats.list", { limit: 1 }, { timeoutMs });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    await client.stop();
  }
}
