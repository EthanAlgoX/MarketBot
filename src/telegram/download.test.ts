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

import { describe, expect, it, vi } from "vitest";

import { downloadTelegramFile, getTelegramFile, type TelegramFileInfo } from "./download.js";

describe("telegram download", () => {
  it("fetches file info", async () => {
    const json = vi.fn().mockResolvedValue({ ok: true, result: { file_path: "photos/1.jpg" } });
    vi.spyOn(global, "fetch" as never).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json,
    } as Response);
    const info = await getTelegramFile("tok", "fid");
    expect(info.file_path).toBe("photos/1.jpg");
  });

  it("downloads and saves", async () => {
    const info: TelegramFileInfo = {
      file_id: "fid",
      file_path: "photos/1.jpg",
    };
    const arrayBuffer = async () => new Uint8Array([1, 2, 3, 4]).buffer;
    vi.spyOn(global, "fetch" as never).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      body: true,
      arrayBuffer,
      headers: { get: () => "image/jpeg" },
    } as Response);
    const saved = await downloadTelegramFile("tok", info, 1024 * 1024);
    expect(saved.path).toBeTruthy();
    expect(saved.contentType).toBe("image/jpeg");
  });
});
