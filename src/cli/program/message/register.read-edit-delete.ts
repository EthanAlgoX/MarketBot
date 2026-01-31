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
import type { MessageCliHelpers } from "./helpers.js";

export function registerMessageReadEditDeleteCommands(
  message: Command,
  helpers: MessageCliHelpers,
) {
  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message.command("read").description("Read recent messages"),
      ),
    )
    .option("--limit <n>", "Result limit")
    .option("--before <id>", "Read/search before id")
    .option("--after <id>", "Read/search after id")
    .option("--around <id>", "Read around id")
    .option("--include-thread", "Include thread replies (Discord)", false)
    .action(async (opts) => {
      await helpers.runMessageAction("read", opts);
    });

  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message
          .command("edit")
          .description("Edit a message")
          .requiredOption("--message-id <id>", "Message id")
          .requiredOption("-m, --message <text>", "Message body"),
      ),
    )
    .option("--thread-id <id>", "Thread id (Telegram forum thread)")
    .action(async (opts) => {
      await helpers.runMessageAction("edit", opts);
    });

  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message
          .command("delete")
          .description("Delete a message")
          .requiredOption("--message-id <id>", "Message id"),
      ),
    )
    .action(async (opts) => {
      await helpers.runMessageAction("delete", opts);
    });
}
