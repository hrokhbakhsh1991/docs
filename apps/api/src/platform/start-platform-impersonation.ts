import { getPrismaAdmin } from "../db/prisma.ts";
import {
  PLATFORM_AUDIT_ACTION_IMPERSONATE_START,
  appendPlatformAuditEvent,
} from "./platform-audit-logger.ts";
import { PlatformValidation } from "./platform.errors.ts";
import { PlatformTenantRepository } from "./platform-tenant.repository.ts";
import { resolveImpersonationOwnerSubject } from "./resolve-impersonation-owner-subject.ts";
import { signPlatformImpersonationSessionToken } from "./sign-platform-impersonation-session-token.ts";

export async function startPlatformImpersonation(input: {
  readonly tenantId: string;
  readonly actorId: string;
}): Promise<{ sessionToken: string; exchangePath: string; expiresAt: string }> {
  const repository = new PlatformTenantRepository();
  const tenant = await repository.getById(input.tenantId);
  if (!tenant) {
    throw new PlatformValidation("TENANT_NOT_FOUND");
  }

  const owner = await resolveImpersonationOwnerSubject(input.tenantId);
  if (!owner) {
    throw new PlatformValidation("TENANT_OWNER_NOT_READY");
  }

  const sessionToken = await signPlatformImpersonationSessionToken({
    userId: owner.userId,
    tenantId: input.tenantId,
    sessionVersion: owner.sessionVersion,
    platformImpersonator: input.actorId,
  });

  const prisma = getPrismaAdmin();
  await prisma.$transaction((tx) =>
    appendPlatformAuditEvent(tx, {
      action: PLATFORM_AUDIT_ACTION_IMPERSONATE_START,
      entityType: "tenant",
      entityId: input.tenantId,
      actorId: input.actorId,
      metadata: { tenantId: input.tenantId, subdomain: tenant.subdomain },
    })
  );

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  return { sessionToken, exchangePath: "/auth/platform-impersonate", expiresAt };
}
