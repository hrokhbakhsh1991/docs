import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { DENALI_SMOKE_SUBDOMAIN, DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { appendAuditEvent, AUDIT_ACTION_TENANT_PROVISIONED } from "../audit/audit-logger";
import { getPrismaAdmin } from "../db/prisma";
import { invalidateTenantRegistryCache } from "../tenant/tenant-registry-cache";
import { findTenantBySubdomain, isStaticTenantRegistryAllowed } from "../tenant/tenant-registry";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { TenantProvisionConflictError } from "./provisioning.errors";
import { assertProvisioningDevelopmentOnly } from "./provisioning-guard";

/** MAP 4.3 — canonical dev seed labels (subphase 4.3). */
export const PHASE_43_SEED_SUBDOMAINS = ["tenant-a", "tenant-b"] as const;

/** Stable UUIDs for MAP 4.3 seeds — used when DATABASE_URL disables static registry. */
export const PHASE_43_SEED_TENANT_IDS: Record<Phase43SeedSubdomain, string> = {
  "tenant-a": "00000000-0000-4000-8000-000000000001",
  "tenant-b": "00000000-0000-4000-8000-000000000002",
};

export { DENALI_SMOKE_SUBDOMAIN, DENALI_SMOKE_TENANT_ID };

export const TENANT_STATUS_ACTIVE = "active" as const;

export type Phase43SeedSubdomain = (typeof PHASE_43_SEED_SUBDOMAINS)[number];

function isPhase43SeedSubdomain(subdomain: string): subdomain is Phase43SeedSubdomain {
  return (PHASE_43_SEED_SUBDOMAINS as readonly string[]).includes(subdomain);
}

export type ProvisionTenantInput = {
  readonly subdomain: string;
  /** Required for unknown subdomains; seed tenants use registry UUIDs when omitted. */
  readonly tenantId?: string;
  readonly workspaceType?: string;
  readonly status?: string;
  readonly theme?: unknown;
};

export type ProvisionedTenant = {
  readonly id: string;
  readonly subdomain: string;
  readonly workspaceType: string;
  readonly status: string;
};

type ResolvedTenantIdentity = {
  readonly tenantId: string;
  readonly subdomain: string;
  readonly workspaceType: string;
  readonly status: string;
  readonly theme: Prisma.InputJsonValue;
};

/**
 * Phase 4.3 provisioning — seeds `tenant-a` / `tenant-b` and backs
 * `POST /internal/tenants/provision` (development only).
 *
 * Tenant rows are created via {@link getPrismaAdmin} only (no RLS on `tenants`;
 * the principal does not exist until after insert). Tour I/O must use
 * {@link withTenantRls} with explicit tenant scope.
 *
 * @see docs/phase-4/subphases/4.3-provisioning.md
 */
export class ProvisioningService {
  /**
   * Idempotent seed for MAP 4.3 two-tenant isolation tests (upsert by subdomain).
   */
  async seedDevTenants(): Promise<readonly ProvisionedTenant[]> {
    assertProvisioningDevelopmentOnly();
    const results: ProvisionedTenant[] = [];
    for (const subdomain of PHASE_43_SEED_SUBDOMAINS) {
      results.push(await this.upsertSeedTenant({ subdomain }));
    }
    return results;
  }

  /** Phase 6.6 — idempotent denali smoke tenant (`denali.localhost`). */
  async seedDenaliSmokeTenant(): Promise<ProvisionedTenant> {
    assertProvisioningDevelopmentOnly();
    return this.upsertSeedTenant({
      subdomain: DENALI_SMOKE_SUBDOMAIN,
      tenantId: DENALI_SMOKE_TENANT_ID,
      workspaceType: "denali",
    });
  }

  /**
   * Create tenant when id + subdomain are absent (POST /internal/tenants/provision).
   */
  async provisionTenant(input: ProvisionTenantInput): Promise<ProvisionedTenant> {
    assertProvisioningDevelopmentOnly();
    const identity = resolveTenantIdentity(input);
    await assertTenantNotAlreadyPresent(identity.tenantId, identity.subdomain);
    return createTenantRow(identity);
  }

  /** Idempotent MAP 4.3 seed — upsert by subdomain. */
  private async upsertSeedTenant(input: ProvisionTenantInput): Promise<ProvisionedTenant> {
    assertProvisioningDevelopmentOnly();
    const identity = resolveTenantIdentity(input);
    const prisma = getPrismaAdmin();

    const row = await prisma.tenant.upsert({
      where: { subdomain: identity.subdomain },
      create: {
        id: identity.tenantId,
        subdomain: identity.subdomain,
        workspaceType: identity.workspaceType,
        status: identity.status,
        theme: identity.theme,
      },
      update: {
        workspaceType: identity.workspaceType,
        status: identity.status,
        theme: identity.theme,
      },
      select: {
        id: true,
        subdomain: true,
        workspaceType: true,
        status: true,
      },
    });

    invalidateTenantRegistryCache(row.id, row.subdomain);

    return {
      id: row.id,
      subdomain: row.subdomain,
      workspaceType: row.workspaceType,
      status: row.status,
    };
  }
}

async function assertTenantNotAlreadyPresent(tenantId: string, subdomain: string): Promise<void> {
  const prisma = getPrismaAdmin();
  const [byId, bySubdomain] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    prisma.tenant.findUnique({ where: { subdomain }, select: { id: true } }),
  ]);
  if (byId !== null) {
    throw new TenantProvisionConflictError("TENANT_ID_ALREADY_EXISTS");
  }
  if (bySubdomain !== null) {
    throw new TenantProvisionConflictError("TENANT_SUBDOMAIN_ALREADY_EXISTS");
  }
}

async function createTenantRow(identity: ResolvedTenantIdentity): Promise<ProvisionedTenant> {
  const prisma = getPrismaAdmin();
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        id: identity.tenantId,
        subdomain: identity.subdomain,
        workspaceType: identity.workspaceType,
        status: identity.status,
        theme: identity.theme,
      },
      select: {
        id: true,
        subdomain: true,
        workspaceType: true,
        status: true,
      },
    });

    await runWithTenantContext(created.id, async () => {
      await appendAuditEvent(tx, {
        action: AUDIT_ACTION_TENANT_PROVISIONED,
        entityType: "tenant",
        entityId: created.id,
      });
    });

    return created;
  });
  invalidateTenantRegistryCache(row.id, row.subdomain);
  return {
    id: row.id,
    subdomain: row.subdomain,
    workspaceType: row.workspaceType,
    status: row.status,
  };
}

function resolveTenantIdentity(input: ProvisionTenantInput): ResolvedTenantIdentity {
  const subdomain = input.subdomain.trim().toLowerCase();
  const registered = isStaticTenantRegistryAllowed() ? findTenantBySubdomain(subdomain) : null;
  const seedTenantId = isPhase43SeedSubdomain(subdomain)
    ? PHASE_43_SEED_TENANT_IDS[subdomain]
    : undefined;
  const tenantId = input.tenantId ?? registered?.id ?? seedTenantId;

  if (tenantId === undefined || tenantId.trim().length === 0) {
    throw new Error("PROVISIONING_TENANT_ID_REQUIRED");
  }

  assertValidTenantUuid(tenantId);

  if (registered !== null && input.tenantId !== undefined && input.tenantId !== registered.id) {
    throw new Error("PROVISIONING_TENANT_ID_MISMATCH");
  }

  const workspaceType = input.workspaceType ?? registered?.workspaceType ?? "starter";
  const status = input.status ?? TENANT_STATUS_ACTIVE;
  const theme: Prisma.InputJsonValue = coerceInputJson(input.theme ?? registered?.theme ?? {});

  return { tenantId, subdomain, workspaceType, status, theme };
}

const UUID_V4ISH = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function coerceInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function assertValidTenantUuid(tenantId: string): void {
  if (!UUID_V4ISH.test(tenantId.trim())) {
    throw new Error("PROVISIONING_TENANT_ID_INVALID_UUID");
  }
}

/** Dev-only helper when caller does not supply a registry-bound id. */
export function newProvisionTenantId(): string {
  return randomUUID();
}
