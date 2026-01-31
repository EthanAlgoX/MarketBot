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
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hasAnyWhatsAppAuth, listWhatsAppAuthDirs } from "./accounts.js";

describe("hasAnyWhatsAppAuth", () => {
  let previousOauthDir: string | undefined;
  let tempOauthDir: string | undefined;

  const writeCreds = (dir: string) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "creds.json"), JSON.stringify({ me: {} }));
  };

  beforeEach(() => {
    previousOauthDir = process.env.MARKETBOT_OAUTH_DIR;
    tempOauthDir = fs.mkdtempSync(path.join(os.tmpdir(), "marketbot-oauth-"));
    process.env.MARKETBOT_OAUTH_DIR = tempOauthDir;
  });

  afterEach(() => {
    if (previousOauthDir === undefined) {
      delete process.env.MARKETBOT_OAUTH_DIR;
    } else {
      process.env.MARKETBOT_OAUTH_DIR = previousOauthDir;
    }
    if (tempOauthDir) {
      fs.rmSync(tempOauthDir, { recursive: true, force: true });
      tempOauthDir = undefined;
    }
  });

  it("returns false when no auth exists", () => {
    expect(hasAnyWhatsAppAuth({})).toBe(false);
  });

  it("returns true when legacy auth exists", () => {
    fs.writeFileSync(path.join(tempOauthDir ?? "", "creds.json"), JSON.stringify({ me: {} }));
    expect(hasAnyWhatsAppAuth({})).toBe(true);
  });

  it("returns true when non-default auth exists", () => {
    writeCreds(path.join(tempOauthDir ?? "", "whatsapp", "work"));
    expect(hasAnyWhatsAppAuth({})).toBe(true);
  });

  it("includes authDir overrides", () => {
    const customDir = fs.mkdtempSync(path.join(os.tmpdir(), "marketbot-wa-auth-"));
    try {
      writeCreds(customDir);
      const cfg = {
        channels: { whatsapp: { accounts: { work: { authDir: customDir } } } },
      };

      expect(listWhatsAppAuthDirs(cfg)).toContain(customDir);
      expect(hasAnyWhatsAppAuth(cfg)).toBe(true);
    } finally {
      fs.rmSync(customDir, { recursive: true, force: true });
    }
  });
});
