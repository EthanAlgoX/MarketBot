#!/usr/bin/env node

/**
 * Context Guardian Setup
 *
 * Runs after npm install to ensure the data directory exists.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const DATA_DIR = path.join(os.homedir(), '.context-guardian');

console.log('Setting up Context Guardian...\n');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Created data directory: ${DATA_DIR}`);
}

console.log('\nContext Guardian setup complete.');
console.log('Try: context-guardian status\n');
