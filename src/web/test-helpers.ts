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

import { vi } from "vitest";

import type { MockBaileysSocket } from "../../test/mocks/baileys.js";
import { createMockBaileys } from "../../test/mocks/baileys.js";

// Use globalThis to store the mock config so it survives vi.mock hoisting
const CONFIG_KEY = Symbol.for("marketbot:testConfigMock");
const DEFAULT_CONFIG = {
  channels: {
    whatsapp: {
      // Tests can override; default remains open to avoid surprising fixtures
      allowFrom: ["*"],
    },
  },
  messages: {
    messagePrefix: undefined,
    responsePrefix: undefined,
  },
};

// Initialize default if not set
if (!(globalThis as Record<symbol, unknown>)[CONFIG_KEY]) {
  (globalThis as Record<symbol, unknown>)[CONFIG_KEY] = () => DEFAULT_CONFIG;
}

export function setLoadConfigMock(fn: unknown) {
  (globalThis as Record<symbol, unknown>)[CONFIG_KEY] = typeof fn === "function" ? fn : () => fn;
}

export function resetLoadConfigMock() {
  (globalThis as Record<symbol, unknown>)[CONFIG_KEY] = () => DEFAULT_CONFIG;
}

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => {
      const getter = (globalThis as Record<symbol, unknown>)[CONFIG_KEY];
      if (typeof getter === "function") {
        return getter();
      }
      return DEFAULT_CONFIG;
    },
  };
});

vi.mock("../media/store.js", () => ({
  saveMediaBuffer: vi.fn().mockImplementation(async (_buf: Buffer, contentType?: string) => ({
    id: "mid",
    path: "/tmp/mid",
    size: _buf.length,
    contentType,
  })),
}));

vi.mock("@whiskeysockets/baileys", () => {
  const created = createMockBaileys();
  (globalThis as Record<PropertyKey, unknown>)[Symbol.for("marketbot:lastSocket")] =
    created.lastSocket;
  return created.mod;
});

vi.mock("qrcode-terminal", () => ({
  default: { generate: vi.fn() },
  generate: vi.fn(),
}));

export const baileys =
  (await import("@whiskeysockets/baileys")) as unknown as typeof import("@whiskeysockets/baileys") & {
    makeWASocket: ReturnType<typeof vi.fn>;
    useMultiFileAuthState: ReturnType<typeof vi.fn>;
    fetchLatestBaileysVersion: ReturnType<typeof vi.fn>;
    makeCacheableSignalKeyStore: ReturnType<typeof vi.fn>;
  };

export function resetBaileysMocks() {
  const recreated = createMockBaileys();
  (globalThis as Record<PropertyKey, unknown>)[Symbol.for("marketbot:lastSocket")] =
    recreated.lastSocket;
  baileys.makeWASocket.mockImplementation(recreated.mod.makeWASocket);
  baileys.useMultiFileAuthState.mockImplementation(recreated.mod.useMultiFileAuthState);
  baileys.fetchLatestBaileysVersion.mockImplementation(recreated.mod.fetchLatestBaileysVersion);
  baileys.makeCacheableSignalKeyStore.mockImplementation(recreated.mod.makeCacheableSignalKeyStore);
}

export function getLastSocket(): MockBaileysSocket {
  const getter = (globalThis as Record<PropertyKey, unknown>)[Symbol.for("marketbot:lastSocket")];
  if (typeof getter === "function") {
    return (getter as () => MockBaileysSocket)();
  }
  if (!getter) {
    throw new Error("Baileys mock not initialized");
  }
  throw new Error("Invalid Baileys socket getter");
}
