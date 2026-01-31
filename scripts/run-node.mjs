#!/usr/bin/env node
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

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const env = { ...process.env };
const cwd = process.cwd();
const compilerOverride = env.MARKETBOT_TS_COMPILER;
const compiler = compilerOverride === 'tsc' ? 'tsc' : 'tsgo';
const projectArgs = ['--project', 'tsconfig.json', '--noEmit', 'false'];

const distRoot = path.join(cwd, 'dist');
const distEntry = path.join(distRoot, '/entry.js');
const buildStampPath = path.join(distRoot, '.buildstamp');
const srcRoot = path.join(cwd, 'src');
const configFiles = [
  path.join(cwd, 'tsconfig.json'),
  path.join(cwd, 'package.json'),
];

const statMtime = (filePath) => {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
};

const isExcludedSource = (filePath) => {
  const relativePath = path.relative(srcRoot, filePath);
  if (relativePath.startsWith('..')) return false;
  return (
    relativePath.endsWith('.test.ts') ||
    relativePath.endsWith('.test.tsx') ||
    relativePath.endsWith(`test-helpers.ts`)
  );
};

const findLatestMtime = (dirPath, shouldSkip) => {
  let latest = null;
  const queue = [dirPath];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (shouldSkip?.(fullPath)) continue;
      const mtime = statMtime(fullPath);
      if (mtime == null) continue;
      if (latest == null || mtime > latest) {
        latest = mtime;
      }
    }
  }
  return latest;
};

const shouldBuild = () => {
  if (env.MARKETBOT_FORCE_BUILD === '1') return true;
  const stampMtime = statMtime(buildStampPath);
  if (stampMtime == null) return true;
  if (statMtime(distEntry) == null) return true;

  for (const filePath of configFiles) {
    const mtime = statMtime(filePath);
    if (mtime != null && mtime > stampMtime) return true;
  }

  const srcMtime = findLatestMtime(srcRoot, isExcludedSource);
  if (srcMtime != null && srcMtime > stampMtime) return true;
  return false;
};

const logRunner = (message) => {
  if (env.MARKETBOT_RUNNER_LOG === '0') return;
  process.stderr.write(`[marketbot] ${message}\n`);
};

const runNode = () => {
  const nodeProcess = spawn(process.execPath, ['marketbot.mjs', ...args], {
    cwd,
    env,
    stdio: 'inherit',
  });

  nodeProcess.on('exit', (exitCode, exitSignal) => {
    if (exitSignal) {
      process.exit(1);
    }
    process.exit(exitCode ?? 1);
  });
};

const writeBuildStamp = () => {
  try {
    fs.mkdirSync(distRoot, { recursive: true });
    fs.writeFileSync(buildStampPath, `${Date.now()}\n`);
  } catch (error) {
    // Best-effort stamp; still allow the runner to start.
    logRunner(
      `Failed to write build stamp: ${error?.message ?? 'unknown error'}`,
    );
  }
};

if (!shouldBuild()) {
  runNode();
} else {
  logRunner('Building TypeScript (dist is stale).');
  const pnpmArgs = ['exec', compiler, ...projectArgs];
  const buildCmd = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
  const buildArgs =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'pnpm', ...pnpmArgs]
      : pnpmArgs;
  const build = spawn(buildCmd, buildArgs, {
    cwd,
    env,
    stdio: 'inherit',
  });

  build.on('exit', (code, signal) => {
    if (signal) {
      process.exit(1);
    }
    if (code !== 0 && code !== null) {
      process.exit(code);
    }
    writeBuildStamp();
    runNode();
  });
}
