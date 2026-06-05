import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { assertProductionStorageDriver } from "../storage/create-tour-storage";
import { assertStaticTenantRegistryRuntime } from "../tenant/tenant-registry";

export {
  PRODUCTION_DATABASE_URL_REQUIRED,
  PRODUCTION_STORAGE_DRIVER_FORBIDDEN,
} from "../storage/create-tour-storage";

export const PRODUCTION_DATABASE_URL_ADMIN_REQUIRED = "PRODUCTION_DATABASE_URL_ADMIN_REQUIRED";
export const PRODUCTION_DATABASE_URL_ADMIN_MUST_DIFFER =
  "PRODUCTION_DATABASE_URL_ADMIN_MUST_DIFFER";

/**
 * Fail-closed production boot checks (DEC-GAP-03, V-004, V-009).
 * @see docs/phase-4/production-deploy-checklist.md
 */
export function assertProductionRuntimeIntegrity(): void {
  assertStaticTenantRegistryRuntime();

  if (!isProductionAuthMode()) {
    return;
  }

  assertProductionStorageDriver();

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  if (!adminUrl) {
    throw new Error(PRODUCTION_DATABASE_URL_ADMIN_REQUIRED);
  }
  if (adminUrl === databaseUrl) {
    throw new Error(PRODUCTION_DATABASE_URL_ADMIN_MUST_DIFFER);
  }
}
