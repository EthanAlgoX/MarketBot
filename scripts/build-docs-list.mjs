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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binDir = path.join(root, "bin");
const scriptPath = path.join(root, "scripts", "docs-list.js");
const binPath = path.join(binDir, "docs-list");

fs.mkdirSync(binDir, { recursive: true });

const wrapper = `#!/usr/bin/env node\nimport { spawnSync } from "node:child_process";\nimport path from "node:path";\nimport { fileURLToPath } from "node:url";\n\nconst here = path.dirname(fileURLToPath(import.meta.url));\nconst script = path.join(here, "..", "scripts", "docs-list.js");\n\nconst result = spawnSync(process.execPath, [script], { stdio: "inherit" });\nprocess.exit(result.status ?? 1);\n`;

fs.writeFileSync(binPath, wrapper, { mode: 0o755 });
