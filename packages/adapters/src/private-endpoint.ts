// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { PrismaClient } from "@marketbot/db";

/**
 * Whether a user may reach loopback, LAN and Docker-network endpoints from the server
 * (remote MCP, installed API/GraphQL connectors): the instance flag
 * (`MCP_ALLOW_PRIVATE_ENDPOINT`) or the user being the deployment owner.
 * Hostname is not authorization.
 */
export async function actorMayUsePrivateEndpoint(
  prisma: Pick<PrismaClient, "deploymentSettings">,
  actorUserId: string,
  instanceAllowPrivateEndpoint: boolean,
): Promise<boolean> {
  if (instanceAllowPrivateEndpoint) return true;
  const findUnique = prisma.deploymentSettings?.findUnique;
  if (!findUnique) return false;
  const settings = await findUnique({
    where: { id: "default" },
    select: { ownerUserId: true },
  });
  return settings?.ownerUserId === actorUserId;
}
