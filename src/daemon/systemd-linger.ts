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

import os from "node:os";
import { runCommandWithTimeout, runExec } from "../process/exec.js";

function resolveLoginctlUser(env: Record<string, string | undefined>): string | null {
  const fromEnv = env.USER?.trim() || env.LOGNAME?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  try {
    return os.userInfo().username;
  } catch {
    return null;
  }
}

export type SystemdUserLingerStatus = {
  user: string;
  linger: "yes" | "no";
};

export async function readSystemdUserLingerStatus(
  env: Record<string, string | undefined>,
): Promise<SystemdUserLingerStatus | null> {
  const user = resolveLoginctlUser(env);
  if (!user) {
    return null;
  }
  try {
    const { stdout } = await runExec("loginctl", ["show-user", user, "-p", "Linger"], {
      timeoutMs: 5_000,
    });
    const line = stdout
      .split("\n")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith("Linger="));
    const value = line?.split("=")[1]?.trim().toLowerCase();
    if (value === "yes" || value === "no") {
      return { user, linger: value };
    }
  } catch {
    // ignore; loginctl may be unavailable
  }
  return null;
}

export async function enableSystemdUserLinger(params: {
  env: Record<string, string | undefined>;
  user?: string;
  sudoMode?: "prompt" | "non-interactive";
}): Promise<{ ok: boolean; stdout: string; stderr: string; code: number }> {
  const user = params.user ?? resolveLoginctlUser(params.env);
  if (!user) {
    return { ok: false, stdout: "", stderr: "Missing user", code: 1 };
  }
  const needsSudo = typeof process.getuid === "function" ? process.getuid() !== 0 : true;
  const sudoArgs =
    needsSudo && params.sudoMode !== undefined
      ? ["sudo", ...(params.sudoMode === "non-interactive" ? ["-n"] : [])]
      : [];
  const argv = [...sudoArgs, "loginctl", "enable-linger", user];
  try {
    const result = await runCommandWithTimeout(argv, { timeoutMs: 30_000 });
    return {
      ok: result.code === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code ?? 1,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, stdout: "", stderr: message, code: 1 };
  }
}
