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

import type { Command } from "commander";

import { danger } from "../globals.js";
import { defaultRuntime } from "../runtime.js";
import { callBrowserRequest, type BrowserParentOpts } from "./browser-cli-shared.js";

export function registerBrowserCookiesAndStorageCommands(
  browser: Command,
  parentOpts: (cmd: Command) => BrowserParentOpts,
) {
  const cookies = browser.command("cookies").description("Read/write cookies");

  cookies
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .action(async (opts, cmd) => {
      const parent = parentOpts(cmd);
      const profile = parent?.browserProfile;
      try {
        const result = await callBrowserRequest<{ cookies?: unknown[] }>(
          parent,
          {
            method: "GET",
            path: "/cookies",
            query: {
              targetId: opts.targetId?.trim() || undefined,
              profile,
            },
          },
          { timeoutMs: 20000 },
        );
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        defaultRuntime.log(JSON.stringify(result.cookies ?? [], null, 2));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  cookies
    .command("set")
    .description("Set a cookie (requires --url or domain+path)")
    .argument("<name>", "Cookie name")
    .argument("<value>", "Cookie value")
    .requiredOption("--url <url>", "Cookie URL scope (recommended)")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .action(async (name: string, value: string, opts, cmd) => {
      const parent = parentOpts(cmd);
      const profile = parent?.browserProfile;
      try {
        const result = await callBrowserRequest(
          parent,
          {
            method: "POST",
            path: "/cookies/set",
            query: profile ? { profile } : undefined,
            body: {
              targetId: opts.targetId?.trim() || undefined,
              cookie: { name, value, url: opts.url },
            },
          },
          { timeoutMs: 20000 },
        );
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        defaultRuntime.log(`cookie set: ${name}`);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  cookies
    .command("clear")
    .description("Clear all cookies")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .action(async (opts, cmd) => {
      const parent = parentOpts(cmd);
      const profile = parent?.browserProfile;
      try {
        const result = await callBrowserRequest(
          parent,
          {
            method: "POST",
            path: "/cookies/clear",
            query: profile ? { profile } : undefined,
            body: {
              targetId: opts.targetId?.trim() || undefined,
            },
          },
          { timeoutMs: 20000 },
        );
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        defaultRuntime.log("cookies cleared");
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  const storage = browser.command("storage").description("Read/write localStorage/sessionStorage");

  function registerStorageKind(kind: "local" | "session") {
    const cmd = storage.command(kind).description(`${kind}Storage commands`);

    cmd
      .command("get")
      .description(`Get ${kind}Storage (all keys or one key)`)
      .argument("[key]", "Key (optional)")
      .option("--target-id <id>", "CDP target id (or unique prefix)")
      .action(async (key: string | undefined, opts, cmd2) => {
        const parent = parentOpts(cmd2);
        const profile = parent?.browserProfile;
        try {
          const result = await callBrowserRequest<{ values?: Record<string, string> }>(
            parent,
            {
              method: "GET",
              path: `/storage/${kind}`,
              query: {
                key: key?.trim() || undefined,
                targetId: opts.targetId?.trim() || undefined,
                profile,
              },
            },
            { timeoutMs: 20000 },
          );
          if (parent?.json) {
            defaultRuntime.log(JSON.stringify(result, null, 2));
            return;
          }
          defaultRuntime.log(JSON.stringify(result.values ?? {}, null, 2));
        } catch (err) {
          defaultRuntime.error(danger(String(err)));
          defaultRuntime.exit(1);
        }
      });

    cmd
      .command("set")
      .description(`Set a ${kind}Storage key`)
      .argument("<key>", "Key")
      .argument("<value>", "Value")
      .option("--target-id <id>", "CDP target id (or unique prefix)")
      .action(async (key: string, value: string, opts, cmd2) => {
        const parent = parentOpts(cmd2);
        const profile = parent?.browserProfile;
        try {
          const result = await callBrowserRequest(
            parent,
            {
              method: "POST",
              path: `/storage/${kind}/set`,
              query: profile ? { profile } : undefined,
              body: {
                key,
                value,
                targetId: opts.targetId?.trim() || undefined,
              },
            },
            { timeoutMs: 20000 },
          );
          if (parent?.json) {
            defaultRuntime.log(JSON.stringify(result, null, 2));
            return;
          }
          defaultRuntime.log(`${kind}Storage set: ${key}`);
        } catch (err) {
          defaultRuntime.error(danger(String(err)));
          defaultRuntime.exit(1);
        }
      });

    cmd
      .command("clear")
      .description(`Clear all ${kind}Storage keys`)
      .option("--target-id <id>", "CDP target id (or unique prefix)")
      .action(async (opts, cmd2) => {
        const parent = parentOpts(cmd2);
        const profile = parent?.browserProfile;
        try {
          const result = await callBrowserRequest(
            parent,
            {
              method: "POST",
              path: `/storage/${kind}/clear`,
              query: profile ? { profile } : undefined,
              body: {
                targetId: opts.targetId?.trim() || undefined,
              },
            },
            { timeoutMs: 20000 },
          );
          if (parent?.json) {
            defaultRuntime.log(JSON.stringify(result, null, 2));
            return;
          }
          defaultRuntime.log(`${kind}Storage cleared`);
        } catch (err) {
          defaultRuntime.error(danger(String(err)));
          defaultRuntime.exit(1);
        }
      });
  }

  registerStorageKind("local");
  registerStorageKind("session");
}
