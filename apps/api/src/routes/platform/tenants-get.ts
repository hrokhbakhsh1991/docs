import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { toPlatformTenantDetailDto } from "../../platform/platform-tenant-detail.dto.ts";
import { PlatformSubscriptionRepository } from "../../platform/platform-subscription.repository.ts";
import { PlatformTenantRepository } from "../../platform/platform-tenant.repository.ts";
import { PlatformUnauthorized } from "../../platform/platform.errors.ts";

export async function handlePlatformTenantsGet(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string,
  deps: {
    repository?: PlatformTenantRepository;
    subscriptionRepository?: PlatformSubscriptionRepository;
    resolveDefinitionDisplayName?: (definitionId: string) => Promise<string | null>;
    auth?: {
      repository?: import("../../platform/platform-ops-user.repository.ts").PlatformOpsUserRepository;
    };
  } = {}
): Promise<void> {
  try {
    await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>, deps.auth ?? {});
  } catch (err: unknown) {
    if (
      err instanceof PlatformUnauthorized ||
      (err as { code?: string })?.code === "PLATFORM_UNAUTHORIZED"
    ) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized", code: "PLATFORM_UNAUTHORIZED" }));
      return;
    }
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
    return;
  }

  const repository = deps.repository ?? new PlatformTenantRepository();
  const row = await repository.getById(tenantId);
  if (!row) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }

  const ownerInvite = await repository.findOwnerInviteSummary(tenantId);
  const subscriptionRepository =
    deps.subscriptionRepository ?? new PlatformSubscriptionRepository();
  const subscription = await subscriptionRepository.getByTenantId(tenantId);
  let definitionDisplayName: string | null = null;
  if (row.workspaceDefinitionId) {
    if (deps.resolveDefinitionDisplayName) {
      definitionDisplayName = await deps.resolveDefinitionDisplayName(row.workspaceDefinitionId);
    } else {
      const { getPrismaAdmin } = await import("../../db/prisma.ts");
      const definition = await getPrismaAdmin().workspaceDefinition.findUnique({
        where: { id: row.workspaceDefinitionId },
        select: { displayName: true },
      });
      definitionDisplayName = definition?.displayName ?? null;
    }
  }
  const siteSurfaces = await repository.getSiteSurfacesByTenantId(tenantId);
  const detail = toPlatformTenantDetailDto({
    tenant: row,
    ownerInvite,
    subscription,
    definitionDisplayName,
    siteSurfaces,
  });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(detail));
}
