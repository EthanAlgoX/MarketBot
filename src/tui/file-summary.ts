/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 */

import fs from "node:fs/promises";
import path from "node:path";

export type CsvSummary = {
  delimiter: "," | "\t" | ";";
  rows: number;
  columns: string[];
  sample: Array<Record<string, string>>;
  numericProfile?: Array<{
    column: string;
    numericCount: number;
    totalCount: number;
    min: number;
    max: number;
    mean: number;
  }>;
  timeSeries?: {
    dateColumn: string;
    startDate: string;
    endDate: string;
    changes: Array<{
      column: string;
      start: number;
      end: number;
      delta: number;
      pct: number | null;
    }>;
  };
  portfolio?: {
    symbolColumn: string;
    quantityColumn: string;
    valueColumn?: string;
    totalRows: number;
    uniqueSymbols: number;
    totalQuantity: number | null;
    totalValueWan: number | null;
    topByValueWan?: Array<{ symbol: string; valueWan: number }>;
    topByQuantity?: Array<{ symbol: string; quantity: number }>;
  };
};

export type JsonSummary = {
  kind: "object" | "array" | "other";
  keys?: string[];
  length?: number;
};

export type LocalFileSummary = {
  path: string;
  ext: string;
  bytes: number;
  type: "csv" | "json" | "text" | "unknown";
  csv?: CsvSummary;
  json?: JsonSummary;
  textPreview?: string;
};

export function formatLocalFileSummary(summary: LocalFileSummary): string[] {
  const lines: string[] = [];
  lines.push(`file: ${summary.path}`);
  lines.push(`type: ${summary.type} (${summary.bytes} bytes)`);

  if (summary.type === "csv" && summary.csv) {
    lines.push(`csv: ${summary.csv.rows} rows, ${summary.csv.columns.length} columns`);
    lines.push(
      `columns: ${summary.csv.columns.slice(0, 16).join(", ")}${summary.csv.columns.length > 16 ? ", ..." : ""}`,
    );
    if (summary.csv.timeSeries) {
      const ts = summary.csv.timeSeries;
      lines.push(`timeSeries: ${ts.startDate} -> ${ts.endDate} (dateColumn=${ts.dateColumn})`);
      for (const c of ts.changes.slice(0, 8)) {
        const pct = c.pct === null ? "n/a" : `${(c.pct * 100).toFixed(2)}%`;
        lines.push(`  ${c.column}: ${c.start} -> ${c.end} (d=${c.delta}, pct=${pct})`);
      }
    }
    if (summary.csv.numericProfile && summary.csv.numericProfile.length > 0) {
      lines.push("numericProfile:");
      for (const p of summary.csv.numericProfile.slice(0, 8)) {
        lines.push(
          `  ${p.column}: n=${p.numericCount}/${p.totalCount} min=${p.min} max=${p.max} mean=${Number(p.mean.toFixed(6))}`,
        );
      }
    }
    if (summary.csv.portfolio) {
      const p = summary.csv.portfolio;
      lines.push(
        `portfolio: symbols=${p.uniqueSymbols}, rows=${p.totalRows}` +
          (p.totalQuantity !== null ? `, totalQty=${p.totalQuantity}` : "") +
          (p.totalValueWan !== null ? `, totalValueWan=${p.totalValueWan}` : ""),
      );
      if (p.topByValueWan && p.topByValueWan.length > 0) {
        lines.push(
          `topByValueWan: ${p.topByValueWan.map((x) => `${x.symbol}:${x.valueWan}`).join(", ")}`,
        );
      }
      if (p.topByQuantity && p.topByQuantity.length > 0) {
        lines.push(
          `topByQuantity: ${p.topByQuantity.map((x) => `${x.symbol}:${x.quantity}`).join(", ")}`,
        );
      }
    }
  }

  if (summary.type === "json" && summary.json) {
    if (summary.json.kind === "array") {
      lines.push(`json: array length=${summary.json.length ?? 0}`);
    } else if (summary.json.kind === "object") {
      lines.push(
        `json: object keys=${(summary.json.keys ?? []).slice(0, 16).join(", ")}${(summary.json.keys ?? []).length > 16 ? ", ..." : ""}`,
      );
    } else {
      lines.push("json: other");
    }
  }

  if (summary.type === "text" && summary.textPreview) {
    lines.push("preview:");
    lines.push(summary.textPreview);
  }

  return lines;
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return value.slice(0, maxChars) + "\n...(truncated)...";
}

function splitCsvLine(line: string, delimiter: string): string[] {
  // Minimal CSV splitter with quote support for commas/tabs/semicolons.
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? "";
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((v) => v.trim());
}

function detectDelimiter(headerLine: string): CsvSummary["delimiter"] {
  const comma = (headerLine.match(/,/g) ?? []).length;
  const tab = (headerLine.match(/\t/g) ?? []).length;
  const semi = (headerLine.match(/;/g) ?? []).length;
  if (tab >= comma && tab >= semi && tab > 0) {
    return "\t";
  }
  if (semi > comma) {
    return ";";
  }
  return ",";
}

function parseNumberLoose(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseDateLoose(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const t = Date.parse(trimmed);
  return Number.isFinite(t) ? t : null;
}

function buildCsvSummary(csvText: string): CsvSummary {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { delimiter: ",", rows: 0, columns: [], sample: [] };
  }
  const headerLine = lines[0] ?? "";
  const delimiter = detectDelimiter(headerLine);
  const columns = splitCsvLine(headerLine, delimiter);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    const parts = splitCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    for (let c = 0; c < columns.length; c += 1) {
      const key = columns[c] ?? `col_${c + 1}`;
      row[key] = parts[c] ?? "";
    }
    rows.push(row);
  }

  const sample = rows.slice(0, 3);

  // Generic numeric profiling (useful for most finance CSVs).
  const numericProfile: NonNullable<CsvSummary["numericProfile"]> = [];
  for (const col of columns) {
    let numericCount = 0;
    let totalCount = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let sum = 0;
    for (const row of rows) {
      const raw = String(row[col] ?? "").trim();
      if (!raw) {
        continue;
      }
      totalCount += 1;
      const n = parseNumberLoose(raw);
      if (n === null) {
        continue;
      }
      numericCount += 1;
      sum += n;
      if (n < min) {
        min = n;
      }
      if (n > max) {
        max = n;
      }
    }
    // Heuristic: treat as numeric column if most filled entries parse as numbers.
    if (totalCount > 0 && numericCount / totalCount >= 0.6) {
      numericProfile.push({
        column: col,
        numericCount,
        totalCount,
        min,
        max,
        mean: numericCount > 0 ? sum / numericCount : 0,
      });
    }
  }

  // Time-series change summary if a date-like column exists.
  const dateColumnCandidates = ["日期", "date", "Date"];
  const findExactColumn = (candidates: string[]) =>
    candidates.find((c) => columns.some((col) => col.trim() === c)) ?? null;

  const dateColumn = findExactColumn(dateColumnCandidates);
  let timeSeries: CsvSummary["timeSeries"] | undefined;
  if (dateColumn) {
    let startAt: number | null = null;
    let endAt: number | null = null;
    let startRow: Record<string, string> | null = null;
    let endRow: Record<string, string> | null = null;
    let startLabel = "";
    let endLabel = "";

    for (const row of rows) {
      const rawDate = String(row[dateColumn] ?? "").trim();
      if (!rawDate) {
        continue;
      }
      const t = parseDateLoose(rawDate);
      if (t === null) {
        continue;
      }
      if (startAt === null || t < startAt) {
        startAt = t;
        startRow = row;
        startLabel = rawDate;
      }
      if (endAt === null || t > endAt) {
        endAt = t;
        endRow = row;
        endLabel = rawDate;
      }
    }

    if (startRow && endRow && startAt !== null && endAt !== null && startAt !== endAt) {
      const changes: NonNullable<CsvSummary["timeSeries"]>["changes"] = [];
      for (const p of numericProfile) {
        const col = p.column;
        const s = parseNumberLoose(String(startRow[col] ?? ""));
        const e = parseNumberLoose(String(endRow[col] ?? ""));
        if (s === null || e === null) {
          continue;
        }
        const delta = e - s;
        const pct = s === 0 ? null : delta / s;
        changes.push({ column: col, start: s, end: e, delta, pct });
      }
      if (changes.length > 0) {
        timeSeries = {
          dateColumn,
          startDate: startLabel,
          endDate: endLabel,
          changes: changes.toSorted((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 12),
        };
      }
    }
  }

  // Portfolio heuristic for the repo example CSVs (Chinese headers).
  const symbolColumnCandidates = ["标的代码", "symbol", "ticker"];
  const quantityColumnCandidates = ["持仓数量", "quantity", "qty", "shares"];
  const valueColumnCandidates = ["市值(万元)", "市值", "marketValue", "value"];

  const findColumn = (candidates: string[]) =>
    candidates.find((c) => columns.some((col) => col.trim() === c)) ?? null;

  const symbolColumn = findColumn(symbolColumnCandidates);
  const quantityColumn = findColumn(quantityColumnCandidates);
  const valueColumn = findColumn(valueColumnCandidates);

  let portfolio: CsvSummary["portfolio"] | undefined;
  if (symbolColumn && quantityColumn) {
    const bySymbol = new Map<
      string,
      { quantity: number; valueWan: number; hasQuantity: boolean; hasValue: boolean }
    >();
    let totalQuantity = 0;
    let totalValueWan = 0;
    let anyQuantity = false;
    let anyValue = false;

    for (const row of rows) {
      const sym = String(row[symbolColumn] ?? "").trim();
      if (!sym) {
        continue;
      }
      const q = parseNumberLoose(String(row[quantityColumn] ?? ""));
      const v = valueColumn ? parseNumberLoose(String(row[valueColumn] ?? "")) : null;
      const entry = bySymbol.get(sym) ?? {
        quantity: 0,
        valueWan: 0,
        hasQuantity: false,
        hasValue: false,
      };
      if (q !== null) {
        entry.quantity += q;
        entry.hasQuantity = true;
        totalQuantity += q;
        anyQuantity = true;
      }
      if (v !== null) {
        entry.valueWan += v;
        entry.hasValue = true;
        totalValueWan += v;
        anyValue = true;
      }
      bySymbol.set(sym, entry);
    }

    const topByValueWan =
      anyValue && bySymbol.size > 0
        ? Array.from(bySymbol.entries())
            .map(([symbol, v]) => ({ symbol, valueWan: v.valueWan }))
            .toSorted((a, b) => b.valueWan - a.valueWan)
            .slice(0, 5)
        : undefined;
    const topByQuantity =
      anyQuantity && bySymbol.size > 0
        ? Array.from(bySymbol.entries())
            .map(([symbol, v]) => ({ symbol, quantity: v.quantity }))
            .toSorted((a, b) => b.quantity - a.quantity)
            .slice(0, 5)
        : undefined;

    portfolio = {
      symbolColumn,
      quantityColumn,
      ...(valueColumn ? { valueColumn } : {}),
      totalRows: rows.length,
      uniqueSymbols: bySymbol.size,
      totalQuantity: anyQuantity ? totalQuantity : null,
      totalValueWan: anyValue ? totalValueWan : null,
      ...(topByValueWan ? { topByValueWan } : {}),
      ...(topByQuantity ? { topByQuantity } : {}),
    };
  }

  const out: CsvSummary = { delimiter, rows: rows.length, columns, sample };
  if (numericProfile.length > 0) {
    out.numericProfile = numericProfile.slice(0, 24);
  }
  if (timeSeries) {
    out.timeSeries = timeSeries;
  }
  if (portfolio) {
    out.portfolio = portfolio;
  }
  return out;
}

function buildJsonSummary(value: unknown): JsonSummary {
  if (Array.isArray(value)) {
    return { kind: "array", length: value.length };
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).slice(0, 40);
    return { kind: "object", keys };
  }
  return { kind: "other" };
}

export async function summarizeLocalFile(params: {
  filePath: string;
  cwd?: string;
  maxBytes?: number;
  maxPreviewChars?: number;
}): Promise<LocalFileSummary> {
  const cwd = params.cwd ?? process.cwd();
  const resolved = path.resolve(cwd, params.filePath);
  const stat = await fs.stat(resolved);
  const maxBytes = params.maxBytes ?? 5 * 1024 * 1024;
  if (stat.size > maxBytes) {
    throw new Error(`file too large: ${stat.size} bytes (limit ${maxBytes})`);
  }
  const ext = path.extname(resolved).toLowerCase();
  const raw = await fs.readFile(resolved, "utf8");

  if (ext === ".csv" || ext === ".tsv") {
    const csv = buildCsvSummary(raw);
    return {
      path: resolved,
      ext,
      bytes: stat.size,
      type: "csv",
      csv,
    };
  }

  if (ext === ".json") {
    const value = JSON.parse(raw) as unknown;
    return {
      path: resolved,
      ext,
      bytes: stat.size,
      type: "json",
      json: buildJsonSummary(value),
      textPreview: clampText(raw, params.maxPreviewChars ?? 2000),
    };
  }

  if (ext === ".md" || ext === ".txt" || ext === ".log") {
    return {
      path: resolved,
      ext,
      bytes: stat.size,
      type: "text",
      textPreview: clampText(raw, params.maxPreviewChars ?? 2000),
    };
  }

  return {
    path: resolved,
    ext,
    bytes: stat.size,
    type: "unknown",
    textPreview: clampText(raw, params.maxPreviewChars ?? 2000),
  };
}
