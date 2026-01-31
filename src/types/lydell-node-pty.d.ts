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

declare module "@lydell/node-pty" {
  export type PtyExitEvent = { exitCode: number; signal?: number };
  export type PtyListener<T> = (event: T) => void;
  export type PtyHandle = {
    pid: number;
    write: (data: string | Buffer) => void;
    onData: (listener: PtyListener<string>) => void;
    onExit: (listener: PtyListener<PtyExitEvent>) => void;
  };

  export type PtySpawn = (
    file: string,
    args: string[] | string,
    options: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string>;
    },
  ) => PtyHandle;

  export const spawn: PtySpawn;
}
