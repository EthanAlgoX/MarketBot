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

import { describe, expect, it } from "vitest";

import { createPluginRuntime } from "./index.js";

describe("createPluginRuntime", () => {
  it("exposes stable and experimental namespaces while preserving legacy fields", () => {
    const runtime = createPluginRuntime();

    expect(runtime.version).toBe(runtime.stable.version);
    expect(runtime.channel.reply.dispatchReplyFromConfig).toBe(
      runtime.stable.channel.reply.dispatchReplyFromConfig,
    );
    expect(runtime.channel.whatsapp.loginWeb).toBe(runtime.experimental.channel.whatsapp.loginWeb);
    expect(runtime.channel.telegram.probeTelegram).toBe(
      runtime.experimental.channel.telegram.probeTelegram,
    );
  });

  it("keeps stable channel namespace free of experimental channel bindings", () => {
    const runtime = createPluginRuntime();
    expect("whatsapp" in runtime.stable.channel).toBe(false);
    expect("discord" in runtime.stable.channel).toBe(false);
  });
});
