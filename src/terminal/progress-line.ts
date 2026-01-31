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

let activeStream: NodeJS.WriteStream | null = null;

export function registerActiveProgressLine(stream: NodeJS.WriteStream): void {
  if (!stream.isTTY) {
    return;
  }
  activeStream = stream;
}

export function clearActiveProgressLine(): void {
  if (!activeStream?.isTTY) {
    return;
  }
  activeStream.write("\r\x1b[2K");
}

export function unregisterActiveProgressLine(stream?: NodeJS.WriteStream): void {
  if (!activeStream) {
    return;
  }
  if (stream && activeStream !== stream) {
    return;
  }
  activeStream = null;
}
