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

import { splitMediaFromOutput } from "./parse.js";

describe("splitMediaFromOutput", () => {
  it("detects audio_as_voice tag and strips it", () => {
    const result = splitMediaFromOutput("Hello [[audio_as_voice]] world");
    expect(result.audioAsVoice).toBe(true);
    expect(result.text).toBe("Hello world");
  });

  it("rejects absolute media paths to prevent LFI", () => {
    const result = splitMediaFromOutput("MEDIA:/Users/pete/My File.png");
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe("MEDIA:/Users/pete/My File.png");
  });

  it("rejects quoted absolute media paths to prevent LFI", () => {
    const result = splitMediaFromOutput('MEDIA:"/Users/pete/My File.png"');
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe('MEDIA:"/Users/pete/My File.png"');
  });

  it("rejects tilde media paths to prevent LFI", () => {
    const result = splitMediaFromOutput("MEDIA:~/Pictures/My File.png");
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe("MEDIA:~/Pictures/My File.png");
  });

  it("rejects directory traversal media paths to prevent LFI", () => {
    const result = splitMediaFromOutput("MEDIA:../../etc/passwd");
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe("MEDIA:../../etc/passwd");
  });

  it("captures safe relative media paths", () => {
    const result = splitMediaFromOutput("MEDIA:./screenshots/image.png");
    expect(result.mediaUrls).toEqual(["./screenshots/image.png"]);
    expect(result.text).toBe("");
  });

  it("keeps audio_as_voice detection stable across calls", () => {
    const input = "Hello [[audio_as_voice]]";
    const first = splitMediaFromOutput(input);
    const second = splitMediaFromOutput(input);
    expect(first.audioAsVoice).toBe(true);
    expect(second.audioAsVoice).toBe(true);
  });

  it("keeps MEDIA mentions in prose", () => {
    const input = "The MEDIA: tag fails to deliver";
    const result = splitMediaFromOutput(input);
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe(input);
  });

  it("parses MEDIA tags with leading whitespace", () => {
    const result = splitMediaFromOutput("  MEDIA:./screenshot.png");
    expect(result.mediaUrls).toEqual(["./screenshot.png"]);
    expect(result.text).toBe("");
  });
});
