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
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { formatHelpExamples } from "../help-format.js";
import type { ProgramContext } from "./context.js";
import { createMessageCliHelpers } from "./message/helpers.js";
import { registerMessageDiscordAdminCommands } from "./message/register.discord-admin.js";
import {
  registerMessageEmojiCommands,
  registerMessageStickerCommands,
} from "./message/register.emoji-sticker.js";
import {
  registerMessagePermissionsCommand,
  registerMessageSearchCommand,
} from "./message/register.permissions-search.js";
import { registerMessagePinCommands } from "./message/register.pins.js";
import { registerMessagePollCommand } from "./message/register.poll.js";
import { registerMessageReactionsCommands } from "./message/register.reactions.js";
import { registerMessageReadEditDeleteCommands } from "./message/register.read-edit-delete.js";
import { registerMessageSendCommand } from "./message/register.send.js";
import { registerMessageThreadCommands } from "./message/register.thread.js";
import { registerMessageBroadcastCommand } from "./message/register.broadcast.js";

export function registerMessageCommands(program: Command, ctx: ProgramContext) {
  const message = program
    .command("message")
    .description("Send messages and channel actions")
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("Examples:")}
${formatHelpExamples([
  ['marketbot message send --target +15555550123 --message "Hi"', "Send a text message."],
  [
    'marketbot message send --target +15555550123 --message "Hi" --media photo.jpg',
    "Send a message with media.",
  ],
  [
    'marketbot message poll --channel discord --target channel:123 --poll-question "Snack?" --poll-option Pizza --poll-option Sushi',
    "Create a Discord poll.",
  ],
  [
    'marketbot message react --channel discord --target 123 --message-id 456 --emoji "✅"',
    "React to a message.",
  ],
])}

${theme.muted("Docs:")} ${formatDocsLink("/cli/message", "docs.marketbot.ai/cli/message")}`,
    )
    .action(() => {
      message.help({ error: true });
    });

  const helpers = createMessageCliHelpers(message, ctx.messageChannelOptions);
  registerMessageSendCommand(message, helpers);
  registerMessageBroadcastCommand(message, helpers);
  registerMessagePollCommand(message, helpers);
  registerMessageReactionsCommands(message, helpers);
  registerMessageReadEditDeleteCommands(message, helpers);
  registerMessagePinCommands(message, helpers);
  registerMessagePermissionsCommand(message, helpers);
  registerMessageSearchCommand(message, helpers);
  registerMessageThreadCommands(message, helpers);
  registerMessageEmojiCommands(message, helpers);
  registerMessageStickerCommands(message, helpers);
  registerMessageDiscordAdminCommands(message, helpers);
}
