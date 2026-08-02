import { performance } from "node:perf_hooks";

import type { Prisma } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";
import { metricsRegistry } from "../observability/metrics";
import { recordAdminPoolRead } from "./admin-pool-read-monitor";

/**
 * PSR-5c — named control-plane reasons for tenant-registry admin pool I/O.
 * Call sites must pass a reason; raw getPrismaAdmin is confined to this module.
 */
export const TENANT_REGISTRY_ADMIN_REASON = {
  REGISTRY_RESOLVE_BY_ID: "REGISTRY_RESOLVE_BY_ID",
  REGISTRY_RESOLVE_BY_SUBDOMAIN: "REGISTRY_RESOLVE_BY_SUBDOMAIN",
  REGISTRY_RESOLVE_THEME: "REGISTRY_RESOLVE_THEME",
  REGISTRY_RESOLVE_FINANCE_WORKSPACE: "REGISTRY_RESOLVE_FINANCE_WORKSPACE",
  REGISTRY_UPDATE: "REGISTRY_UPDATE",
} as const;

export type TenantRegistryAdminReason =
  (typeof TENANT_REGISTRY_ADMIN_REASON)[keyof typeof TENANT_REGISTRY_ADMIN_REASON];

export type TenantRegistryAdminRow = {
  readonly id: string;
  readonly subdomain: string;
  readonly workspaceType: string;
  readonly theme: unknown;
};

function recordAccess(reason: TenantRegistryAdminReason): void {
  metricsRegistry.increment("tenant_registry_admin_access_total", { reason });
}

/**
 * Sole owner of admin-pool `tenants` I/O for registry resolve/update (PSR-5c).
 */
export async function findTenantRowById(
  tenantId: string,
  reason: typeof TENANT_REGISTRY_ADMIN_REASON.REGISTRY_RESOLVE_BY_ID
): Promise<TenantRegistryAdminRow | null> {
  recordAccess(reason);
  const readStarted = performance.now();
  const row = await getPrismaAdmin().tenant.findUnique({
    where: { id: tenantId },
  });
  recordAdminPoolRead(performance.now() - readStarted);
  return row;
}

export async function findTenantRowBySubdomain(
  subdomain: string,
  reason: typeof TENANT_REGISTRY_ADMIN_REASON.REGISTRY_RESOLVE_BY_SUBDOMAIN
): Promise<TenantRegistryAdminRow | null> {
  recordAccess(reason);
  const readStarted = performance.now();
  const row = await getPrismaAdmin().tenant.findUnique({
    where: { subdomain },
  });
  recordAdminPoolRead(performance.now() - readStarted);
  return row;
}

export async function findTenantThemeById(
  tenantId: string,
  reason: typeof TENANT_REGISTRY_ADMIN_REASON.REGISTRY_RESOLVE_THEME
): Promise<unknown | null> {
  recordAccess(reason);
  const readStarted = performance.now();
  const row = await getPrismaAdmin().tenant.findUnique({
    where: { id: tenantId },
    select: { theme: true },
  });
  recordAdminPoolRead(performance.now() - readStarted);
  return row !== null ? row.theme : null;
}

/**
 * Raw finance gate row — preserves full theme JSON (e.g. enabledModules).
 * Do not substitute {@link resolveRegisteredTenantById} branding merge here (PSR-5d).
 */
export async function findTenantFinanceWorkspaceRow(
  tenantId: string,
  reason: typeof TENANT_REGISTRY_ADMIN_REASON.REGISTRY_RESOLVE_FINANCE_WORKSPACE
): Promise<{ readonly workspaceType: string; readonly theme: unknown } | null> {
  recordAccess(reason);
  const readStarted = performance.now();
  const row = await getPrismaAdmin().tenant.findUnique({
    where: { id: tenantId },
    select: { workspaceType: true, theme: true },
  });
  recordAdminPoolRead(performance.now() - readStarted);
  return row;
}

export async function findTenantIdSubdomainById(
  tenantId: string,
  reason: typeof TENANT_REGISTRY_ADMIN_REASON.REGISTRY_UPDATE
): Promise<{ readonly id: string; readonly subdomain: string } | null> {
  recordAccess(reason);
  const readStarted = performance.now();
  const row = await getPrismaAdmin().tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, subdomain: true },
  });
  recordAdminPoolRead(performance.now() - readStarted);
  return row;
}

export async function updateTenantRow(
  tenantId: string,
  data: Prisma.TenantUpdateInput,
  reason: typeof TENANT_REGISTRY_ADMIN_REASON.REGISTRY_UPDATE
): Promise<{ readonly id: string; readonly subdomain: string }> {
  recordAccess(reason);
  const row = await getPrismaAdmin().tenant.update({
    where: { id: tenantId },
    data,
    select: { id: true, subdomain: true },
  });
  return row;
}
