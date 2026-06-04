import type { TenantThemeConfig } from "@app-tour/workspace-sdk";

import { logger } from "../observability/logger";

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
];

function warnDevTenantRegistryInProduction(): void {
  if (process.env.NODE_ENV === "production") {
    logger.warn(
      {
        event: "tenant.registry.dev_tenants",
        count: DEV_TENANTS.length,
      },
      "DEV_TENANTS static registry is active in production — replace with tenant-kernel / DB resolution before go-live",
    );
  }
}

warnDevTenantRegistryInProduction();

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
