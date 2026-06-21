import type { PrismaClient } from "@prisma/client";

import { inviteTenantOwner } from "./invite-tenant-owner.ts";
import { PLATFORM_PROVISION_INVITE_ACTOR_USER_ID } from "./platform-invite-actor-user-id.ts";
import {
  PLATFORM_AUDIT_ACTION_TENANT_UPDATED,
  appendPlatformAuditEvent,
} from "./platform-audit-logger.ts";
import { PlatformValidation } from "./platform.errors.ts";
import {
  PlatformTenantRepository,
  platformTenantSelect,
  type PlatformTenantRecord,
} from "./platform-tenant.repository.ts";
import { invalidateTenantRegistryCache } from "../tenant/tenant-registry-cache.ts";

export type PlatformOwnerInviteRecord = {
  readonly inviteId: string;
  readonly phone: string;
  readonly status: string;
};

function defaultPrisma(): PrismaClient {
  const { getPrismaAdmin } = require("../db/prisma") as typeof import("../db/prisma");
  return getPrismaAdmin();
}

export async function loadPlatformOwnerInviteSummary(
  tenantId: string,
  prisma: PrismaClient = defaultPrisma()
): Promise<PlatformOwnerInviteRecord | null> {
  const row = await prisma.operatorPendingInvite.findFirst({
    where: { tenantId, role: "owner", status: "INVITED" },
    orderBy: { createdAt: "desc" },
    select: { inviteId: true, phone: true, status: true },
  });
  return row ?? null;
}

export async function updatePlatformTenantStatus(input: {
  tenantId: string;
  status: "active" | "suspended";
  actorId: string;
  repository?: PlatformTenantRepository;
}): Promise<PlatformTenantRecord | null> {
  const repository = input.repository ?? new PlatformTenantRepository();
  const existing = await repository.getById(input.tenantId);
  if (!existing) {
    return null;
  }
  if (existing.status === input.status) {
    return existing;
  }

  const prisma = defaultPrisma();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.tenant.update({
      where: { id: input.tenantId },
      data: { status: input.status },
      select: platformTenantSelect,
    });

    if (input.status === "suspended") {
      await tx.userTenant.updateMany({
        where: { tenantId: input.tenantId },
        data: { sessionVersion: { increment: 1 } },
      });
    }

    await appendPlatformAuditEvent(tx, {
      action: PLATFORM_AUDIT_ACTION_TENANT_UPDATED,
      entityType: "tenant",
      entityId: row.id,
      actorId: input.actorId,
      metadata: { status: input.status, previousStatus: existing.status },
    });
    return row;
  });

  invalidateTenantRegistryCache(updated.id, updated.subdomain);
  return updated;
}

export async function resendPlatformTenantOwnerInvite(input: {
  tenantId: string;
  actorId: string;
  phone?: string;
  repository?: PlatformTenantRepository;
}): Promise<{ inviteId: string; inviteToken: string } | null> {
  const repository = input.repository ?? new PlatformTenantRepository();
  const tenant = await repository.getById(input.tenantId);
  if (!tenant) {
    return null;
  }

  const prisma = defaultPrisma();
  const pending = await loadPlatformOwnerInviteSummary(input.tenantId, prisma);
  const phone = input.phone?.trim() || pending?.phone;
  if (!phone || phone.length < 8) {
    throw new PlatformValidation("owner phone required to resend invite");
  }

  return prisma.$transaction(async (tx) => {
    await tx.operatorPendingInvite.deleteMany({
      where: { tenantId: input.tenantId, role: "owner", status: "INVITED" },
    });
    return inviteTenantOwner(tx, {
      tenantId: input.tenantId,
      phone,
      invitedByUserId: PLATFORM_PROVISION_INVITE_ACTOR_USER_ID,
    });
  });
}
