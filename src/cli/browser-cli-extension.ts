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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Command } from "commander";

import { STATE_DIR } from "../config/paths.js";
import { danger, info } from "../globals.js";
import { copyToClipboard } from "../infra/clipboard.js";
import { defaultRuntime } from "../runtime.js";
import { movePathToTrash } from "../browser/trash.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { shortenHomePath } from "../utils.js";
import { formatCliCommand } from "./command-format.js";

function bundledExtensionRootDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../assets/chrome-extension");
}

function installedExtensionRootDir() {
  return path.join(STATE_DIR, "browser", "chrome-extension");
}

function hasManifest(dir: string) {
  return fs.existsSync(path.join(dir, "manifest.json"));
}

export async function installChromeExtension(opts?: {
  stateDir?: string;
  sourceDir?: string;
}): Promise<{ path: string }> {
  const src = opts?.sourceDir ?? bundledExtensionRootDir();
  if (!hasManifest(src)) {
    throw new Error("Bundled Chrome extension is missing. Reinstall MarketBot and try again.");
  }

  const stateDir = opts?.stateDir ?? STATE_DIR;
  const dest = path.join(stateDir, "browser", "chrome-extension");
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (fs.existsSync(dest)) {
    await movePathToTrash(dest).catch(() => {
      const backup = `${dest}.old-${Date.now()}`;
      fs.renameSync(dest, backup);
    });
  }

  await fs.promises.cp(src, dest, { recursive: true });
  if (!hasManifest(dest)) {
    throw new Error("Chrome extension install failed (manifest.json missing). Try again.");
  }

  return { path: dest };
}

export function registerBrowserExtensionCommands(
  browser: Command,
  parentOpts: (cmd: Command) => { json?: boolean },
) {
  const ext = browser.command("extension").description("Chrome extension helpers");

  ext
    .command("install")
    .description("Install the Chrome extension to a stable local path")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      let installed: { path: string };
      try {
        installed = await installChromeExtension();
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }

      if (parent?.json) {
        defaultRuntime.log(JSON.stringify({ ok: true, path: installed.path }, null, 2));
        return;
      }
      const displayPath = shortenHomePath(installed.path);
      defaultRuntime.log(displayPath);
      const copied = await copyToClipboard(installed.path).catch(() => false);
      defaultRuntime.error(
        info(
          [
            copied ? "Copied to clipboard." : "Copy to clipboard unavailable.",
            "Next:",
            `- Chrome → chrome://extensions → enable “Developer mode”`,
            `- “Load unpacked” → select: ${displayPath}`,
            `- Pin “MarketBot Browser Relay”, then click it on the tab (badge shows ON)`,
            "",
            `${theme.muted("Docs:")} ${formatDocsLink("/tools/chrome-extension", "docs.marketbot.ai/tools/chrome-extension")}`,
          ].join("\n"),
        ),
      );
    });

  ext
    .command("path")
    .description("Print the path to the installed Chrome extension (load unpacked)")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      const dir = installedExtensionRootDir();
      if (!hasManifest(dir)) {
        defaultRuntime.error(
          danger(
            [
              `Chrome extension is not installed. Run: "${formatCliCommand("marketbot browser extension install")}"`,
              `Docs: ${formatDocsLink("/tools/chrome-extension", "docs.marketbot.ai/tools/chrome-extension")}`,
            ].join("\n"),
          ),
        );
        defaultRuntime.exit(1);
      }
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify({ path: dir }, null, 2));
        return;
      }
      const displayPath = shortenHomePath(dir);
      defaultRuntime.log(displayPath);
      const copied = await copyToClipboard(dir).catch(() => false);
      if (copied) {
        defaultRuntime.error(info("Copied to clipboard."));
      }
    });
}
