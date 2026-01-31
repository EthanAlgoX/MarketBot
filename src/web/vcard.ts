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

type ParsedVcard = {
  name?: string;
  phones: string[];
};

const ALLOWED_VCARD_KEYS = new Set(["FN", "N", "TEL"]);

export function parseVcard(vcard?: string): ParsedVcard {
  if (!vcard) {
    return { phones: [] };
  }
  const lines = vcard.split(/\r?\n/);
  let nameFromN: string | undefined;
  let nameFromFn: string | undefined;
  const phones: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const key = line.slice(0, colonIndex).toUpperCase();
    const rawValue = line.slice(colonIndex + 1).trim();
    if (!rawValue) {
      continue;
    }
    const baseKey = normalizeVcardKey(key);
    if (!baseKey || !ALLOWED_VCARD_KEYS.has(baseKey)) {
      continue;
    }
    const value = cleanVcardValue(rawValue);
    if (!value) {
      continue;
    }
    if (baseKey === "FN" && !nameFromFn) {
      nameFromFn = normalizeVcardName(value);
      continue;
    }
    if (baseKey === "N" && !nameFromN) {
      nameFromN = normalizeVcardName(value);
      continue;
    }
    if (baseKey === "TEL") {
      const phone = normalizeVcardPhone(value);
      if (phone) {
        phones.push(phone);
      }
    }
  }
  return { name: nameFromFn ?? nameFromN, phones };
}

function normalizeVcardKey(key: string): string | undefined {
  const [primary] = key.split(";");
  if (!primary) {
    return undefined;
  }
  const segments = primary.split(".");
  return segments[segments.length - 1] || undefined;
}

function cleanVcardValue(value: string): string {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
}

function normalizeVcardName(value: string): string {
  return value.replace(/;/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeVcardPhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.toLowerCase().startsWith("tel:")) {
    return trimmed.slice(4).trim();
  }
  return trimmed;
}
