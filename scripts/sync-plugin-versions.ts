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

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type PackageJson = {
  name?: string;
  version?: string;
};

const root = resolve(".");
const rootPackagePath = resolve("package.json");
const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8")) as PackageJson;
const targetVersion = rootPackage.version;

if (!targetVersion) {
  throw new Error("Root package.json missing version.");
}

const extensionsDir = resolve("extensions");
const dirs = readdirSync(extensionsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());

const updated: string[] = [];
const changelogged: string[] = [];
const skipped: string[] = [];

function ensureChangelogEntry(changelogPath: string, version: string): boolean {
  if (!existsSync(changelogPath)) return false;
  const content = readFileSync(changelogPath, "utf8");
  if (content.includes(`## ${version}`)) return false;
  const entry = `## ${version}\n\n### Changes\n- Version alignment with core MarketBot release numbers.\n\n`;
  if (content.startsWith("# Changelog\n\n")) {
    const next = content.replace("# Changelog\n\n", `# Changelog\n\n${entry}`);
    writeFileSync(changelogPath, next);
    return true;
  }
  const next = `# Changelog\n\n${entry}${content.trimStart()}`;
  writeFileSync(changelogPath, `${next}\n`);
  return true;
}

for (const dir of dirs) {
  const packagePath = join(extensionsDir, dir.name, "package.json");
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(readFileSync(packagePath, "utf8")) as PackageJson;
  } catch {
    continue;
  }

  if (!pkg.name) {
    skipped.push(dir.name);
    continue;
  }

  const changelogPath = join(extensionsDir, dir.name, "CHANGELOG.md");
  if (ensureChangelogEntry(changelogPath, targetVersion)) {
    changelogged.push(pkg.name);
  }

  if (pkg.version === targetVersion) {
    skipped.push(pkg.name);
    continue;
  }

  pkg.version = targetVersion;
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  updated.push(pkg.name);
}

console.log(
  `Synced plugin versions to ${targetVersion}. Updated: ${updated.length}. Changelogged: ${changelogged.length}. Skipped: ${skipped.length}.`
);
