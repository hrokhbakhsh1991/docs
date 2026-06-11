import type { TenantThemeConfig } from "@app-tour/workspace-sdk";

import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { logger } from "../observability/logger";

export const PRODUCTION_STATIC_TENANT_REGISTRY_FORBIDDEN =
  "PRODUCTION_STATIC_TENANT_REGISTRY_FORBIDDEN";
export const PRODLIKE_DATABASE_URL_REQUIRED_FOR_REGISTRY =
  "PRODLIKE_DATABASE_URL_REQUIRED_FOR_REGISTRY";

export type RegisteredTenant = {
  readonly id: string;
  readonly subdomain: string;
  readonly workspaceType: string;
  readonly theme: TenantThemeConfig;
};

const DEV_TENANTS: readonly RegisteredTenant[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    subdomain: "tenant-a",
    workspaceType: "starter",
    theme: { primaryColor: "#2563eb", cssVariables: { "--color-primary": "#2563eb" } },
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    subdomain: "tenant-b",
    workspaceType: "starter",
    theme: { primaryColor: "#dc2626", cssVariables: { "--color-primary": "#dc2626" } },
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    subdomain: "denali",
    workspaceType: "denali",
    theme: { primaryColor: "#0f766e", cssVariables: { "--color-primary": "#0f766e" } },
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    subdomain: "urban",
    workspaceType: "urban",
    theme: {
      primaryColor: "#0d9488",
      cssVariables: { "--color-primary": "#0d9488" },
      defaultLocale: "en",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000000014",
    subdomain: "operator",
    workspaceType: "denali",
    theme: { primaryColor: "#0f766e", cssVariables: { "--color-primary": "#0f766e" } },
  },
];

/**
 * HT-01 — static `DEV_TENANTS` may back resolution only in test, or in development
 * without `DATABASE_URL`. Production and DB-backed dev paths use Postgres `tenants`.
 */
export function isStaticTenantRegistryAllowed(): boolean {
  if (isProductionAuthMode()) {
    return false;
  }
  if (process.env.NODE_ENV === "test") {
    return true;
  }
  if (process.env.NODE_ENV === "development") {
    return !process.env.DATABASE_URL?.trim();
  }
  return false;
}

/**
 * Dev/test only: after a Postgres miss, resolve MAP 4.3 smoke tenants from {@link DEV_TENANTS}.
 * Keeps DATABASE_URL as the primary source while allowing `denali.localhost` without a DB row.
 */
export function canResolveDevTenantRegistryFallback(): boolean {
  if (isProductionAuthMode()) {
    return false;
  }
  const nodeEnv = process.env.NODE_ENV ?? "development";
  return nodeEnv === "test" || nodeEnv === "development";
}

/**
 * Boot-time fail-closed for static registry in prod-like deploys (DI-REG-01 / DEC-039).
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-025, DEC-039
 */
export function assertStaticTenantRegistryRuntime(): void {
  if (isProductionAuthMode()) {
    if (isStaticTenantRegistryAllowed()) {
      throw new Error(PRODUCTION_STATIC_TENANT_REGISTRY_FORBIDDEN);
    }
    return;
  }

  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv !== "test" && nodeEnv !== "development" && !process.env.DATABASE_URL?.trim()) {
    throw new Error(PRODLIKE_DATABASE_URL_REQUIRED_FOR_REGISTRY);
  }
}

function warnDevTenantRegistryWhenAllowed(): void {
  if (isStaticTenantRegistryAllowed() && process.env.NODE_ENV === "development") {
    logger.warn(
      {
        event: "tenant.registry.dev_tenants",
        count: DEV_TENANTS.length,
      },
      "DEV_TENANTS static registry active — set DATABASE_URL for Postgres-backed tenant resolution"
    );
  }
}

warnDevTenantRegistryWhenAllowed();

export function listRegisteredTenants(): readonly RegisteredTenant[] {
  return DEV_TENANTS;
}

export function findTenantBySubdomain(subdomain: string): RegisteredTenant | null {
  const normalized = subdomain.trim().toLowerCase();
  return DEV_TENANTS.find((t) => t.subdomain === normalized) ?? null;
}

export function findTenantById(tenantId: string): RegisteredTenant | null {
  const normalized = tenantId.trim().toLowerCase();
  return DEV_TENANTS.find((t) => t.id === normalized) ?? null;
}
