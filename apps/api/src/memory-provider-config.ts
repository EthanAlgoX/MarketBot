// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.

import type { SecretStore } from "@marketbot/adapter-kit";
import {
  classifyMemoryProviderSettings,
  MemoryProviderDeploymentOwnerRequiredError,
  memoryProviderRequiresDeploymentOwner,
  prepareMemoryProviderConnection,
  toStringRecord,
} from "@marketbot/adapters";
import type { Actor } from "@marketbot/contracts";
import { findSpaceMemoryConfig, Prisma, type PrismaClient } from "@marketbot/db";
import { ORPCError } from "@orpc/server";
import { withSerializableRetry } from "./serializable-retry.js";

export interface MemoryProviderConfigDeps {
  prisma: PrismaClient;
  secrets: Pick<SecretStore, "put">;
  /** Test seam: override DNS/trust classification without probing. */
  classifySettings?: (
    provider: string,
    settings: Record<string, string>,
  ) => Promise<Record<string, string>>;
  /** Test seam: override prepare/probe. */
  prepareConnection?: (
    input: Parameters<typeof prepareMemoryProviderConnection>[0],
  ) => ReturnType<typeof prepareMemoryProviderConnection>;
}

async function requireSpaceOwner(prisma: PrismaClient, actor: Actor): Promise<void> {
  const member = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: actor.spaceId, userId: actor.userId } },
    select: { role: true },
  });
  const roles = member?.role.split(",").map((role) => role.trim());
  if (!roles?.includes("owner")) throw new ORPCError("FORBIDDEN");
}

export async function persistMemoryProviderConfig(
  deps: MemoryProviderConfigDeps,
  actor: Actor,
  input: {
    provider: string;
    settings: Record<string, string>;
    credentials: Record<string, string>;
    defaultMemoryScope: "isolated" | "shared";
  },
) {
  await requireSpaceOwner(deps.prisma, actor);
  let prepared: Awaited<ReturnType<typeof prepareMemoryProviderConnection>>;
  try {
    // Fast-path known private endpoints before probing.
    if (
      memoryProviderRequiresDeploymentOwner(input.provider, input.settings) &&
      !actor.isDeploymentOwner
    ) {
      throw new ORPCError("FORBIDDEN");
    }
    const classify = deps.classifySettings ?? classifyMemoryProviderSettings;
    const prepare = deps.prepareConnection ?? prepareMemoryProviderConnection;
    // Classify DNS/trust before any credentialed probe so LAN endpoints stay owner-gated.
    const classifiedSettings = await classify(input.provider, input.settings);
    if (
      memoryProviderRequiresDeploymentOwner(input.provider, classifiedSettings) &&
      !actor.isDeploymentOwner
    ) {
      throw new ORPCError("FORBIDDEN");
    }
    prepared = await prepare({
      ...input,
      settings: classifiedSettings,
      allowPrivateEndpoint: actor.isDeploymentOwner,
    });
    // Defense in depth if prepare reclassified further.
    if (
      memoryProviderRequiresDeploymentOwner(prepared.provider, prepared.settings) &&
      !actor.isDeploymentOwner
    ) {
      throw new ORPCError("FORBIDDEN");
    }
  } catch (error) {
    if (error instanceof ORPCError) throw error;
    if (error instanceof MemoryProviderDeploymentOwnerRequiredError) {
      throw new ORPCError("FORBIDDEN");
    }
    throw new ORPCError("BAD_REQUEST", {
      message: error instanceof Error ? error.message : "Memory provider connection failed",
    });
  }
  const stored = await deps.secrets.put(JSON.stringify(prepared.credentials), {
    operationId: "memory-provider-config",
    traceId: "memory-provider-config",
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: new AbortController().signal,
  });
  const config = await withSerializableRetry(() =>
    deps.prisma.$transaction(
      async (tx) => {
        const existing = await findSpaceMemoryConfig(tx, actor.spaceId);
        const secret = await tx.secret.create({
          data: {
            id: stored.id,
            userId: actor.userId,
            spaceId: actor.spaceId,
            kind: "memory-provider",
            ciphertext: stored.ciphertext,
          },
        });
        const updated = await tx.spaceMemoryConfig.upsert({
          where: { spaceId: actor.spaceId },
          create: {
            spaceId: actor.spaceId,
            userId: actor.userId,
            provider: prepared.provider,
            settings: prepared.settings,
            secretId: secret.id,
            defaultMemoryScope: input.defaultMemoryScope,
          },
          update: {
            userId: actor.userId,
            provider: prepared.provider,
            settings: prepared.settings,
            secretId: secret.id,
            defaultMemoryScope: input.defaultMemoryScope,
          },
        });
        if (existing && existing.secretId !== secret.id) {
          await tx.secret.deleteMany({ where: { id: existing.secretId } });
        }
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  return serializeSpaceMemoryConfig(config);
}

export async function updateMemoryProviderDefaultScope(
  deps: MemoryProviderConfigDeps,
  actor: Actor,
  defaultMemoryScope: "isolated" | "shared",
) {
  await requireSpaceOwner(deps.prisma, actor);
  const existing = await findSpaceMemoryConfig(deps.prisma, actor.spaceId);
  if (!existing) throw new ORPCError("NOT_FOUND");
  const updated = await deps.prisma.spaceMemoryConfig.update({
    where: { id: existing.id },
    data: { defaultMemoryScope },
  });
  return serializeSpaceMemoryConfig(updated);
}

export function serializeSpaceMemoryConfig(config: {
  provider: string;
  settings: unknown;
  defaultMemoryScope: string;
  updatedAt: Date;
}) {
  return {
    provider: config.provider,
    settings: toStringRecord(config.settings),
    defaultMemoryScope: config.defaultMemoryScope as "isolated" | "shared",
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function disconnectMemoryProvider(deps: MemoryProviderConfigDeps, actor: Actor) {
  await requireSpaceOwner(deps.prisma, actor);
  await withSerializableRetry(() =>
    deps.prisma.$transaction(
      async (tx) => {
        const existing = await findSpaceMemoryConfig(tx, actor.spaceId);
        if (!existing) return;
        await tx.spaceMemoryConfig.delete({ where: { id: existing.id } });
        await tx.secret.deleteMany({ where: { id: existing.secretId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  return { ok: true as const };
}
