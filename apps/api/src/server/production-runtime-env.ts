import { assertProductionRedisUrl } from "../middleware/tenant-rate-limit-config";
import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { assertProductionStorageDriver } from "../storage/production-storage-driver-assert";
import { assertStaticTenantRegistryRuntime } from "../tenant/tenant-registry";
import {
  PRODUCTION_DATABASE_URL_ADMIN_MUST_DIFFER,
  PRODUCTION_DATABASE_URL_ADMIN_REQUIRED,
} from "./production-env-codes";

export {
  PRODUCTION_DATABASE_URL_REQUIRED,
  PRODUCTION_STORAGE_DRIVER_FORBIDDEN,
} from "../storage/production-storage-driver-assert";

export {
  PRODUCTION_DATABASE_URL_ADMIN_REQUIRED,
  PRODUCTION_DATABASE_URL_ADMIN_MUST_DIFFER,
} from "./production-env-codes";

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
  assertProductionRedisUrl();

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  if (!adminUrl) {
    throw new Error(PRODUCTION_DATABASE_URL_ADMIN_REQUIRED);
  }
  if (adminUrl === databaseUrl) {
    throw new Error(PRODUCTION_DATABASE_URL_ADMIN_MUST_DIFFER);
  }
}
