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

import { beforeEach, describe, expect, it, vi } from "vitest";

const loadJsonFile = vi.fn();
const saveJsonFile = vi.fn();
const resolveStateDir = vi.fn().mockReturnValue("/tmp/marketbot-state");

vi.mock("../infra/json-file.js", () => ({
  loadJsonFile,
  saveJsonFile,
}));

vi.mock("../config/paths.js", () => ({
  resolveStateDir,
}));

describe("github-copilot token", () => {
  beforeEach(() => {
    vi.resetModules();
    loadJsonFile.mockReset();
    saveJsonFile.mockReset();
    resolveStateDir.mockReset();
    resolveStateDir.mockReturnValue("/tmp/marketbot-state");
  });

  it("derives baseUrl from token", async () => {
    const { deriveCopilotApiBaseUrlFromToken } = await import("./github-copilot-token.js");

    expect(deriveCopilotApiBaseUrlFromToken("token;proxy-ep=proxy.example.com;")).toBe(
      "https://api.example.com",
    );
    expect(deriveCopilotApiBaseUrlFromToken("token;proxy-ep=https://proxy.foo.bar;")).toBe(
      "https://api.foo.bar",
    );
  });

  it("uses cache when token is still valid", async () => {
    const now = Date.now();
    loadJsonFile.mockReturnValue({
      token: "cached;proxy-ep=proxy.example.com;",
      expiresAt: now + 60 * 60 * 1000,
      updatedAt: now,
    });

    const { resolveCopilotApiToken } = await import("./github-copilot-token.js");

    const fetchImpl = vi.fn();
    const res = await resolveCopilotApiToken({
      githubToken: "gh",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(res.token).toBe("cached;proxy-ep=proxy.example.com;");
    expect(res.baseUrl).toBe("https://api.example.com");
    expect(String(res.source)).toContain("cache:");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fetches and stores token when cache is missing", async () => {
    loadJsonFile.mockReturnValue(undefined);

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        token: "fresh;proxy-ep=https://proxy.contoso.test;",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    });

    const { resolveCopilotApiToken } = await import("./github-copilot-token.js");

    const res = await resolveCopilotApiToken({
      githubToken: "gh",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(res.token).toBe("fresh;proxy-ep=https://proxy.contoso.test;");
    expect(res.baseUrl).toBe("https://api.contoso.test");
    expect(saveJsonFile).toHaveBeenCalledTimes(1);
  });
});
