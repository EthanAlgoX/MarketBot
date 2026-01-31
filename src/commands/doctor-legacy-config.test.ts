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

import { normalizeLegacyConfigValues } from "./doctor-legacy-config.js";

describe("normalizeLegacyConfigValues", () => {
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

  it("does not add whatsapp config when missing and no auth exists", () => {
    const res = normalizeLegacyConfigValues({
      messages: { ackReaction: "👀" },
    });

    expect(res.config.channels?.whatsapp).toBeUndefined();
    expect(res.changes).toEqual([]);
  });

  it("copies legacy ack reaction when whatsapp config exists", () => {
    const res = normalizeLegacyConfigValues({
      messages: { ackReaction: "👀", ackReactionScope: "group-mentions" },
      channels: { whatsapp: {} },
    });

    expect(res.config.channels?.whatsapp?.ackReaction).toEqual({
      emoji: "👀",
      direct: false,
      group: "mentions",
    });
    expect(res.changes).toEqual([
      "Copied messages.ackReaction → channels.whatsapp.ackReaction (scope: group-mentions).",
    ]);
  });

  it("does not add whatsapp config when only auth exists (issue #900)", () => {
    const credsDir = path.join(tempOauthDir ?? "", "whatsapp", "default");
    writeCreds(credsDir);

    const res = normalizeLegacyConfigValues({
      messages: { ackReaction: "👀", ackReactionScope: "group-mentions" },
    });

    expect(res.config.channels?.whatsapp).toBeUndefined();
    expect(res.changes).toEqual([]);
  });

  it("does not add whatsapp config when only legacy auth exists (issue #900)", () => {
    const credsPath = path.join(tempOauthDir ?? "", "creds.json");
    fs.writeFileSync(credsPath, JSON.stringify({ me: {} }));

    const res = normalizeLegacyConfigValues({
      messages: { ackReaction: "👀", ackReactionScope: "group-mentions" },
    });

    expect(res.config.channels?.whatsapp).toBeUndefined();
    expect(res.changes).toEqual([]);
  });

  it("does not add whatsapp config when only non-default auth exists (issue #900)", () => {
    const credsDir = path.join(tempOauthDir ?? "", "whatsapp", "work");
    writeCreds(credsDir);

    const res = normalizeLegacyConfigValues({
      messages: { ackReaction: "👀", ackReactionScope: "group-mentions" },
    });

    expect(res.config.channels?.whatsapp).toBeUndefined();
    expect(res.changes).toEqual([]);
  });

  it("copies legacy ack reaction when authDir override exists", () => {
    const customDir = fs.mkdtempSync(path.join(os.tmpdir(), "marketbot-wa-auth-"));
    try {
      writeCreds(customDir);

      const res = normalizeLegacyConfigValues({
        messages: { ackReaction: "👀", ackReactionScope: "group-mentions" },
        channels: { whatsapp: { accounts: { work: { authDir: customDir } } } },
      });

      expect(res.config.channels?.whatsapp?.ackReaction).toEqual({
        emoji: "👀",
        direct: false,
        group: "mentions",
      });
    } finally {
      fs.rmSync(customDir, { recursive: true, force: true });
    }
  });
});
