import type { SkillRequirements } from "./types.js";
import type { SkillCommandSpec, SkillInstallSpec, SkillInvocationPolicy } from "../types.js";

export interface SkillMetadata {
  name: string;
  description?: string;
  emoji?: string;
  homepage?: string;
  skillKey?: string;
  primaryEnv?: string;
  always?: boolean;
  invocation?: SkillInvocationPolicy;
  commands?: SkillCommandSpec[];
  install?: SkillInstallSpec[];
  requirements: SkillRequirements;
}

export function parseSkillMetadata(content: string, fallbackName: string): SkillMetadata {
  const requirements: SkillRequirements = {
    bins: [],
    anyBins: [],
    env: [],
    os: [],
    config: [],
  };

  const trimmed = content.trim();
  const frontMatter = extractFrontMatter(trimmed);
  const meta = parseFrontMatter(frontMatter ?? "");
  const metadataJson = meta.metadata ? safeParseJson(meta.metadata) : undefined;
  const external = resolveExternalMetadata(metadataJson);

  const name = meta.name ?? extractHeading(trimmed) ?? fallbackName;

  if (meta.bins) requirements.bins = meta.bins;
  if (meta.anyBins) requirements.anyBins = meta.anyBins;
  if (meta.env) requirements.env = meta.env;
  if (meta.os) requirements.os = meta.os;
  if (meta.config) requirements.config = meta.config;

  if (external?.requires) {
    if (external.requires.bins) requirements.bins = mergeUnique(requirements.bins, external.requires.bins);
    if (external.requires.anyBins) requirements.anyBins = mergeUnique(requirements.anyBins, external.requires.anyBins);
    if (external.requires.env) requirements.env = mergeUnique(requirements.env, external.requires.env);
    if (external.requires.os) requirements.os = mergeUnique(requirements.os, external.requires.os);
    if (external.requires.config) requirements.config = mergeUnique(requirements.config, external.requires.config);
  }
  if (external?.os) requirements.os = mergeUnique(requirements.os, external.os);

  if (meta.requiresBins) requirements.bins = mergeUnique(requirements.bins, meta.requiresBins);
  if (meta.requiresAnyBins) requirements.anyBins = mergeUnique(requirements.anyBins, meta.requiresAnyBins);
  if (meta.requiresEnv) requirements.env = mergeUnique(requirements.env, meta.requiresEnv);
  if (meta.requiresOs) requirements.os = mergeUnique(requirements.os, meta.requiresOs);
  if (meta.requiresConfig) requirements.config = mergeUnique(requirements.config, meta.requiresConfig);

  return {
    name,
    description: meta.description,
    emoji: meta.emoji ?? external?.emoji,
    homepage: meta.homepage ?? external?.homepage,
    skillKey: meta.skillKey ?? external?.skillKey,
    primaryEnv: meta.primaryEnv ?? external?.primaryEnv,
    always: meta.always ?? external?.always,
    invocation: external?.invocation,
    commands: external?.commands,
    install: external?.install,
    requirements,
  };
}

function extractHeading(content: string): string | null {
  const heading = content.split("\n").find((line) => line.startsWith("# "));
  if (!heading) return null;
  return heading.replace(/^#\s+/, "").trim();
}

function extractFrontMatter(content: string): string | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  return content.slice(3, end).trim();
}

function parseFrontMatter(block: string): {
  name?: string;
  description?: string;
  emoji?: string;
  homepage?: string;
  skillKey?: string;
  primaryEnv?: string;
  always?: boolean;
  metadata?: string;
  bins?: string[];
  anyBins?: string[];
  env?: string[];
  os?: string[];
  config?: string[];
  requiresBins?: string[];
  requiresAnyBins?: string[];
  requiresEnv?: string[];
  requiresOs?: string[];
  requiresConfig?: string[];
} {
  const meta: Record<string, string | string[]> = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([a-zA-Z_.]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2]?.trim();
    if (!value) continue;
    if (value.startsWith("[") && value.endsWith("]")) {
      meta[key] = value
        .slice(1, -1)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    } else {
      meta[key] = value;
    }
  }

  return {
    name: typeof meta.name === "string" ? meta.name : undefined,
    description: typeof meta.description === "string" ? meta.description : undefined,
    emoji: typeof meta.emoji === "string" ? meta.emoji : undefined,
    homepage: typeof meta.homepage === "string" ? meta.homepage : undefined,
    skillKey: typeof meta.skillKey === "string" ? meta.skillKey : undefined,
    primaryEnv: typeof meta.primaryEnv === "string" ? meta.primaryEnv : undefined,
    always: typeof meta.always === "string" ? meta.always === "true" : undefined,
    bins: normalizeList(meta.bins),
    anyBins: normalizeList(meta.anyBins),
    env: normalizeList(meta.env),
    os: normalizeList(meta.os),
    config: normalizeList(meta.config),
    requiresBins: normalizeList(meta["requires.bins"]),
    requiresAnyBins: normalizeList(meta["requires.anyBins"]),
    requiresEnv: normalizeList(meta["requires.env"]),
    requiresOs: normalizeList(meta["requires.os"]),
    requiresConfig: normalizeList(meta["requires.config"]),
    metadata: typeof meta.metadata === "string" ? meta.metadata : undefined,
  };
}

function mergeUnique(existing: string[], next: string[]): string[] {
  const seen = new Set(existing);
  for (const item of next) {
    seen.add(item);
  }
  return Array.from(seen);
}

function normalizeList(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return [value];
}

function safeParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

type ExternalMetadata = {
  emoji?: string;
  homepage?: string;
  skillKey?: string;
  primaryEnv?: string;
  always?: boolean;
  os?: string[];
  requires?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
    os?: string[];
  };
  invocation?: SkillInvocationPolicy;
  commands?: SkillCommandSpec[];
  install?: SkillInstallSpec[];
};

function resolveExternalMetadata(raw?: unknown): ExternalMetadata | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const container = raw as Record<string, unknown>;
  const rawMarketbot = container.marketbot as Record<string, unknown> | undefined;
  const rawTradebot = container.tradebot as Record<string, unknown> | undefined;
  const rawMoltbot = container.moltbot as Record<string, unknown> | undefined;
  const meta = rawMarketbot ?? rawTradebot ?? rawMoltbot ?? container;

  if (!meta || typeof meta !== "object") return undefined;
  const typed = meta as Record<string, unknown>;

  return {
    emoji: asString(typed.emoji),
    homepage: asString(typed.homepage),
    skillKey: asString(typed.skillKey),
    primaryEnv: asString(typed.primaryEnv),
    always: asBool(typed.always),
    os: asStringArray(typed.os),
    requires: normalizeRequires(typed.requires),
    invocation: normalizeInvocation(typed.invocation),
    commands: normalizeCommands(typed.commands),
    install: normalizeInstall(typed.install),
  };
}

function normalizeRequires(value: unknown): ExternalMetadata["requires"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  return {
    bins: asStringArray(obj.bins),
    anyBins: asStringArray(obj.anyBins),
    env: asStringArray(obj.env),
    config: asStringArray(obj.config),
    os: asStringArray(obj.os),
  };
}

function normalizeInvocation(value: unknown): SkillInvocationPolicy | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  return {
    userInvocable: asBool(obj.userInvocable),
    disableModelInvocation: asBool(obj.disableModelInvocation),
  };
}

function normalizeCommands(value: unknown): SkillCommandSpec[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const commands: SkillCommandSpec[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const name = asString(obj.name);
    if (!name) continue;
    const description = asString(obj.description);
    const dispatch = normalizeDispatch(obj.dispatch);
    commands.push({ name, description, dispatch });
  }
  return commands.length > 0 ? commands : undefined;
}

function normalizeDispatch(value: unknown): SkillCommandSpec["dispatch"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  if (obj.kind !== "tool") return undefined;
  const toolName = asString(obj.toolName);
  if (!toolName) return undefined;
  const argMode = obj.argMode === "raw" ? "raw" : undefined;
  return { kind: "tool", toolName, argMode };
}

function normalizeInstall(value: unknown): SkillInstallSpec[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const installs: SkillInstallSpec[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const kind = asString(obj.kind) as SkillInstallSpec["kind"] | undefined;
    if (!kind) continue;
    installs.push({
      id: asString(obj.id),
      kind,
      label: asString(obj.label),
      bins: asStringArray(obj.bins),
      os: asStringArray(obj.os),
      formula: asString(obj.formula),
      package: asString(obj.package),
      module: asString(obj.module),
      url: asString(obj.url),
    });
  }
  return installs.length > 0 ? installs : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "string") return [value.trim()].filter(Boolean);
  return undefined;
}
