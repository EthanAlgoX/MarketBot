#!/usr/bin/env tsx
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
 * Copy HOOK.md files from src/hooks/bundled to dist/hooks/bundled
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const srcBundled = path.join(projectRoot, 'src', 'hooks', 'bundled');
const distBundled = path.join(projectRoot, 'dist', 'hooks', 'bundled');

function copyHookMetadata() {
  if (!fs.existsSync(srcBundled)) {
    console.warn('[copy-hook-metadata] Source directory not found:', srcBundled);
    return;
  }

  if (!fs.existsSync(distBundled)) {
    fs.mkdirSync(distBundled, { recursive: true });
  }

  const entries = fs.readdirSync(srcBundled, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const hookName = entry.name;
    const srcHookDir = path.join(srcBundled, hookName);
    const distHookDir = path.join(distBundled, hookName);
    const srcHookMd = path.join(srcHookDir, 'HOOK.md');
    const distHookMd = path.join(distHookDir, 'HOOK.md');

    if (!fs.existsSync(srcHookMd)) {
      console.warn(`[copy-hook-metadata] No HOOK.md found for ${hookName}`);
      continue;
    }

    if (!fs.existsSync(distHookDir)) {
      fs.mkdirSync(distHookDir, { recursive: true });
    }

    fs.copyFileSync(srcHookMd, distHookMd);
    console.log(`[copy-hook-metadata] Copied ${hookName}/HOOK.md`);
  }

  console.log('[copy-hook-metadata] Done');
}

copyHookMetadata();
