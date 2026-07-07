import type { PlatformTenantRecord } from "./platform-tenant.repository";

export type PlatformTenantDto = {
  readonly id: string;
  readonly subdomain: string;
  readonly workspaceType: string;
  readonly status: string;
  readonly createdAt: string;
};

export function toPlatformTenantDto(row: PlatformTenantRecord): PlatformTenantDto {
  return {
    id: row.id,
    subdomain: row.subdomain,
    workspaceType: row.workspaceType,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
