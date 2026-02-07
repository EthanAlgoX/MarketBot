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

export type ReplyLanguage = "zh" | "en";

export function detectReplyLanguage(text: string): ReplyLanguage | undefined {
  if (!text) {
    return undefined;
  }
  let latin = 0;
  let cjk = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (!code) {
      continue;
    }
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Unified Ideographs Extension A
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
      (code >= 0x2e80 && code <= 0x2eff) || // CJK Radicals Supplement
      (code >= 0x3000 && code <= 0x303f) // CJK Symbols and Punctuation
    ) {
      cjk += 1;
      continue;
    }
    if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
      latin += 1;
    }
  }
  if (cjk === 0 && latin === 0) {
    return undefined;
  }
  if (cjk > 0) {
    return "zh";
  }
  if (latin > 0) {
    return "en";
  }
  return undefined;
}

export function buildReplyLanguageHint(text: string): string | undefined {
  const lang = detectReplyLanguage(text);
  if (!lang) {
    return undefined;
  }
  return lang === "zh" ? "[System: Reply in Chinese.]" : "[System: Reply in English.]";
}
