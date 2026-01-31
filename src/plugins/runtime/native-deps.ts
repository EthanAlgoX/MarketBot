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

export type NativeDependencyHintParams = {
  packageName: string;
  manager?: "pnpm" | "npm" | "yarn";
  rebuildCommand?: string;
  approveBuildsCommand?: string;
  downloadCommand?: string;
};

export function formatNativeDependencyHint(params: NativeDependencyHintParams): string {
  const manager = params.manager ?? "pnpm";
  const rebuildCommand =
    params.rebuildCommand ??
    (manager === "npm"
      ? `npm rebuild ${params.packageName}`
      : manager === "yarn"
        ? `yarn rebuild ${params.packageName}`
        : `pnpm rebuild ${params.packageName}`);
  const approveBuildsCommand =
    params.approveBuildsCommand ??
    (manager === "pnpm" ? `pnpm approve-builds (select ${params.packageName})` : undefined);
  const steps = [approveBuildsCommand, rebuildCommand, params.downloadCommand].filter(
    (step): step is string => Boolean(step),
  );
  if (steps.length === 0) {
    return `Install ${params.packageName} and rebuild its native module.`;
  }
  return `Install ${params.packageName} and rebuild its native module (${steps.join("; ")}).`;
}
