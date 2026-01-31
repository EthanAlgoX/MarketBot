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

import { readConfigFileSnapshot } from "../../config/config.js";
import { loadAndMaybeMigrateDoctorConfig } from "../../commands/doctor-config-flow.js";
import { colorize, isRich, theme } from "../../terminal/theme.js";
import type { RuntimeEnv } from "../../runtime.js";
import { formatCliCommand } from "../command-format.js";
import { shortenHomePath } from "../../utils.js";

const ALLOWED_INVALID_COMMANDS = new Set(["doctor", "logs", "health", "help", "status"]);
const ALLOWED_INVALID_GATEWAY_SUBCOMMANDS = new Set([
  "status",
  "probe",
  "health",
  "discover",
  "call",
  "install",
  "uninstall",
  "start",
  "stop",
  "restart",
]);
let didRunDoctorConfigFlow = false;

function formatConfigIssues(issues: Array<{ path: string; message: string }>): string[] {
  return issues.map((issue) => `- ${issue.path || "<root>"}: ${issue.message}`);
}

export async function ensureConfigReady(params: {
  runtime: RuntimeEnv;
  commandPath?: string[];
}): Promise<void> {
  if (!didRunDoctorConfigFlow) {
    didRunDoctorConfigFlow = true;
    await loadAndMaybeMigrateDoctorConfig({
      options: { nonInteractive: true },
      confirm: async () => false,
    });
  }

  const snapshot = await readConfigFileSnapshot();
  const commandName = params.commandPath?.[0];
  const subcommandName = params.commandPath?.[1];
  const allowInvalid = commandName
    ? ALLOWED_INVALID_COMMANDS.has(commandName) ||
      (commandName === "gateway" &&
        subcommandName &&
        ALLOWED_INVALID_GATEWAY_SUBCOMMANDS.has(subcommandName))
    : false;
  const issues = snapshot.exists && !snapshot.valid ? formatConfigIssues(snapshot.issues) : [];
  const legacyIssues =
    snapshot.legacyIssues.length > 0
      ? snapshot.legacyIssues.map((issue) => `- ${issue.path}: ${issue.message}`)
      : [];

  const invalid = snapshot.exists && !snapshot.valid;
  if (!invalid) {
    return;
  }

  const rich = isRich();
  const muted = (value: string) => colorize(rich, theme.muted, value);
  const error = (value: string) => colorize(rich, theme.error, value);
  const heading = (value: string) => colorize(rich, theme.heading, value);
  const commandText = (value: string) => colorize(rich, theme.command, value);

  params.runtime.error(heading("Config invalid"));
  params.runtime.error(`${muted("File:")} ${muted(shortenHomePath(snapshot.path))}`);
  if (issues.length > 0) {
    params.runtime.error(muted("Problem:"));
    params.runtime.error(issues.map((issue) => `  ${error(issue)}`).join("\n"));
  }
  if (legacyIssues.length > 0) {
    params.runtime.error(muted("Legacy config keys detected:"));
    params.runtime.error(legacyIssues.map((issue) => `  ${error(issue)}`).join("\n"));
  }
  params.runtime.error("");
  params.runtime.error(
    `${muted("Run:")} ${commandText(formatCliCommand("marketbot doctor --fix"))}`,
  );
  if (!allowInvalid) {
    params.runtime.exit(1);
  }
}
