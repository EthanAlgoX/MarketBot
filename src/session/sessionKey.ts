import { createHash } from "node:crypto";

export function normalizeSessionKey(key?: string): string {
  const trimmed = key?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "main";
}

export function sessionIdFromKey(sessionKey: string): string {
  const normalized = normalizeSessionKey(sessionKey).toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  const hash = createHash("sha1").update(normalized).digest("hex").slice(0, 10);
  return slug ? `${slug}-${hash}` : hash;
}
