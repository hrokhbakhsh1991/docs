import { isProductionAuthMode } from "../tenant-kernel/auth-env";

/** Thrown when provisioning APIs run in production or other disallowed environments. */
export class ProvisioningDevOnlyError extends Error {
  readonly code = "PROVISIONING_DEV_ONLY";

  constructor() {
    super("Provisioning is forbidden outside development or test environments");
    this.name = "ProvisioningDevOnlyError";
  }
}

/**
 * Phase 4.3 — non-production gate for provisioning routes and service.
 * Allowed only when `NODE_ENV` is `development` or `test` (not production / staging).
 * @see docs/phase-4/subphases/4.3-provisioning.md
 */
export function assertProvisioningDevelopmentOnly(): void {
  if (isProductionAuthMode()) {
    throw new ProvisioningDevOnlyError();
  }
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== "development" && nodeEnv !== "test") {
    throw new ProvisioningDevOnlyError();
  }
}
