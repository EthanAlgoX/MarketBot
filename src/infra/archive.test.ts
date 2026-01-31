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

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import * as tar from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { extractArchive, resolveArchiveKind, resolvePackedRootDir } from "./archive.js";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-archive-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
});

describe("archive utils", () => {
  it("detects archive kinds", () => {
    expect(resolveArchiveKind("/tmp/file.zip")).toBe("zip");
    expect(resolveArchiveKind("/tmp/file.tgz")).toBe("tar");
    expect(resolveArchiveKind("/tmp/file.tar.gz")).toBe("tar");
    expect(resolveArchiveKind("/tmp/file.tar")).toBe("tar");
    expect(resolveArchiveKind("/tmp/file.txt")).toBeNull();
  });

  it("extracts zip archives", async () => {
    const workDir = await makeTempDir();
    const archivePath = path.join(workDir, "bundle.zip");
    const extractDir = path.join(workDir, "extract");

    const zip = new JSZip();
    zip.file("package/hello.txt", "hi");
    await fs.writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));

    await fs.mkdir(extractDir, { recursive: true });
    await extractArchive({ archivePath, destDir: extractDir, timeoutMs: 5_000 });
    const rootDir = await resolvePackedRootDir(extractDir);
    const content = await fs.readFile(path.join(rootDir, "hello.txt"), "utf-8");
    expect(content).toBe("hi");
  });

  it("extracts tar archives", async () => {
    const workDir = await makeTempDir();
    const archivePath = path.join(workDir, "bundle.tar");
    const extractDir = path.join(workDir, "extract");
    const packageDir = path.join(workDir, "package");

    await fs.mkdir(packageDir, { recursive: true });
    await fs.writeFile(path.join(packageDir, "hello.txt"), "yo");
    await tar.c({ cwd: workDir, file: archivePath }, ["package"]);

    await fs.mkdir(extractDir, { recursive: true });
    await extractArchive({ archivePath, destDir: extractDir, timeoutMs: 5_000 });
    const rootDir = await resolvePackedRootDir(extractDir);
    const content = await fs.readFile(path.join(rootDir, "hello.txt"), "utf-8");
    expect(content).toBe("yo");
  });
});
