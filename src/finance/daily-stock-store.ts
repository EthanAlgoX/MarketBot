/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { resolveStateDir } from "../config/paths.js";
import type { DailyStockRunResult } from "./daily-stock.js";

type DailyStockLastFileV1 = {
  version: 1;
  updatedAtIso: string;
  result: DailyStockRunResult;
};

function nowIso() {
  return new Date().toISOString();
}

function resolveDailyStockDir() {
  const dir = path.join(resolveStateDir(), "finance");
  const filePath = path.join(dir, "daily-stock-last.json");
  return { dir, filePath };
}

async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err: any) {
    if (err && typeof err === "object" && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function loadDailyStockLast(): Promise<DailyStockRunResult | null> {
  const { filePath } = resolveDailyStockDir();
  const raw = await readFileOrNull(filePath);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as DailyStockLastFileV1;
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      return null;
    }
    const result = (parsed as any).result;
    if (!result || typeof result !== "object") {
      return null;
    }
    return result as DailyStockRunResult;
  } catch {
    return null;
  }
}

export async function saveDailyStockLast(result: DailyStockRunResult) {
  const { dir, filePath } = resolveDailyStockDir();
  await fs.mkdir(dir, { recursive: true });
  const payload: DailyStockLastFileV1 = {
    version: 1,
    updatedAtIso: nowIso(),
    result,
  };
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
}
