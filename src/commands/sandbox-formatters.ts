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

/**
 * Formatting utilities for sandbox CLI output
 */

export function formatStatus(running: boolean): string {
  return running ? "🟢 running" : "⚫ stopped";
}

export function formatSimpleStatus(running: boolean): string {
  return running ? "running" : "stopped";
}

export function formatImageMatch(matches: boolean): string {
  return matches ? "✓" : "⚠️  mismatch";
}

export function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Type guard and counter utilities
 */

export type ContainerItem = {
  running: boolean;
  imageMatch: boolean;
  containerName: string;
  sessionKey: string;
  image: string;
  createdAtMs: number;
  lastUsedAtMs: number;
};

export function countRunning<T extends { running: boolean }>(items: T[]): number {
  return items.filter((item) => item.running).length;
}

export function countMismatches<T extends { imageMatch: boolean }>(items: T[]): number {
  return items.filter((item) => !item.imageMatch).length;
}
