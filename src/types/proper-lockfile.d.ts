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

declare module "proper-lockfile" {
  export type RetryOptions = {
    retries?: number;
    factor?: number;
    minTimeout?: number;
    maxTimeout?: number;
    randomize?: boolean;
  };

  export type LockOptions = {
    retries?: number | RetryOptions;
    stale?: number;
    update?: number;
    realpath?: boolean;
  };

  export type ReleaseFn = () => Promise<void>;

  export function lock(path: string, options?: LockOptions): Promise<ReleaseFn>;

  const lockfile: {
    lock: typeof lock;
  };

  export default lockfile;
}
