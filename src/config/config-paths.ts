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

type PathNode = Record<string, unknown>;

const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function parseConfigPath(raw: string): {
  ok: boolean;
  path?: string[];
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Invalid path. Use dot notation (e.g. foo.bar).",
    };
  }
  const parts = trimmed.split(".").map((part) => part.trim());
  if (parts.some((part) => !part)) {
    return {
      ok: false,
      error: "Invalid path. Use dot notation (e.g. foo.bar).",
    };
  }
  if (parts.some((part) => BLOCKED_KEYS.has(part))) {
    return { ok: false, error: "Invalid path segment." };
  }
  return { ok: true, path: parts };
}

export function setConfigValueAtPath(root: PathNode, path: string[], value: unknown): void {
  let cursor: PathNode = root;
  for (let idx = 0; idx < path.length - 1; idx += 1) {
    const key = path[idx];
    const next = cursor[key];
    if (!isPlainObject(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as PathNode;
  }
  cursor[path[path.length - 1]] = value;
}

export function unsetConfigValueAtPath(root: PathNode, path: string[]): boolean {
  const stack: Array<{ node: PathNode; key: string }> = [];
  let cursor: PathNode = root;
  for (let idx = 0; idx < path.length - 1; idx += 1) {
    const key = path[idx];
    const next = cursor[key];
    if (!isPlainObject(next)) {
      return false;
    }
    stack.push({ node: cursor, key });
    cursor = next;
  }
  const leafKey = path[path.length - 1];
  if (!(leafKey in cursor)) {
    return false;
  }
  delete cursor[leafKey];
  for (let idx = stack.length - 1; idx >= 0; idx -= 1) {
    const { node, key } = stack[idx];
    const child = node[key];
    if (isPlainObject(child) && Object.keys(child).length === 0) {
      delete node[key];
    } else {
      break;
    }
  }
  return true;
}

export function getConfigValueAtPath(root: PathNode, path: string[]): unknown {
  let cursor: unknown = root;
  for (const key of path) {
    if (!isPlainObject(cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}
