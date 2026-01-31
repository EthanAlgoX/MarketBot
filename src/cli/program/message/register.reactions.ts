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

export function registerMessageReactionsCommands(message: Command, helpers: MessageCliHelpers) {
  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message.command("react").description("Add or remove a reaction"),
      ),
    )
    .requiredOption("--message-id <id>", "Message id")
    .option("--emoji <emoji>", "Emoji for reactions")
    .option("--remove", "Remove reaction", false)
    .option("--participant <id>", "WhatsApp reaction participant")
    .option("--from-me", "WhatsApp reaction fromMe", false)
    .option("--target-author <id>", "Signal reaction target author (uuid or phone)")
    .option("--target-author-uuid <uuid>", "Signal reaction target author uuid")
    .action(async (opts) => {
      await helpers.runMessageAction("react", opts);
    });

  helpers
    .withMessageBase(
      helpers.withRequiredMessageTarget(
        message.command("reactions").description("List reactions on a message"),
      ),
    )
    .requiredOption("--message-id <id>", "Message id")
    .option("--limit <n>", "Result limit")
    .action(async (opts) => {
      await helpers.runMessageAction("reactions", opts);
    });
}
