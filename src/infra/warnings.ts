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

const warningFilterKey = Symbol.for("marketbot.warning-filter");

type Warning = Error & {
  code?: string;
  name?: string;
  message?: string;
};

function shouldIgnoreWarning(warning: Warning): boolean {
  if (warning.code === "DEP0040" && warning.message?.includes("punycode")) {
    return true;
  }
  if (warning.code === "DEP0060" && warning.message?.includes("util._extend")) {
    return true;
  }
  if (
    warning.name === "ExperimentalWarning" &&
    warning.message?.includes("SQLite is an experimental feature")
  ) {
    return true;
  }
  return false;
}

export function installProcessWarningFilter(): void {
  const globalState = globalThis as typeof globalThis & {
    [warningFilterKey]?: { installed: boolean };
  };
  if (globalState[warningFilterKey]?.installed) {
    return;
  }
  globalState[warningFilterKey] = { installed: true };

  process.on("warning", (warning: Warning) => {
    if (shouldIgnoreWarning(warning)) {
      return;
    }
    process.stderr.write(`${warning.stack ?? warning.toString()}\n`);
  });
}
