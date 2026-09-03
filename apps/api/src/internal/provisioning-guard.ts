const DENALI_WALLET_STAGING_PILOT_TENANT_ID =
  "00000000-0000-4000-8000-000000000430";

const PRODUCTION_MARKERS = [
  "/opt/app-cloud",
  "/etc/app-tour/api.env",
  "production",
  "prod.",
  ".denali.club",
  "app-cloud",
] as const;

export type ProvisioningGuardOptions = {
  readonly stagingPilotTenantId?: string;
};

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
 * Allowed only when `NODE_ENV` is `development` or `test`, except for the
 * explicitly opted-in Denali Wallet pilot seed on the staging VPS.
 * @see docs/phase-4/subphases/4.3-provisioning.md
 */
export function assertProvisioningDevelopmentOnly(
  options: ProvisioningGuardOptions = {}
): void {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "development" || nodeEnv === "test") return;

  if (nodeEnv === "production" && isConfirmedDenaliWalletStagingPilot(options)) {
    return;
  }

  throw new ProvisioningDevOnlyError();
}

function isConfirmedDenaliWalletStagingPilot(options: ProvisioningGuardOptions): boolean {
  if (
    process.env.DENALI_WALLET_DEPLOY_TARGET?.trim() !== "staging" ||
    process.env.DENALI_WALLET_EXECUTION_CONTEXT?.trim() !== "vps" ||
    process.env.DENALI_WALLET_STAGING_CONFIRM?.trim() !== "1" ||
    process.env.DENALI_WALLET_SEED_PILOT?.trim() !== "1" ||
    process.env.DENALI_WALLET_PILOT_TENANT_ID?.trim() !==
      DENALI_WALLET_STAGING_PILOT_TENANT_ID ||
    options.stagingPilotTenantId?.trim() !== DENALI_WALLET_STAGING_PILOT_TENANT_ID ||
    process.env.ENV_DIR?.trim() !== "/etc/app-tour-staging" ||
    process.env.DEPLOY_ROOT?.trim() !== "/opt/app-tour-staging" ||
    process.env.DENALI_WALLET_BULK_TENANT_UPDATE === "1" ||
    process.env.DENALI_WALLET_ENABLE_ALL_TENANTS === "1"
  ) {
    return false;
  }

  const configuredValues = [
    process.env.ENV_DIR,
    process.env.DEPLOY_ROOT,
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_ADMIN,
    process.env.PLATFORM_ROOT_DOMAIN,
    process.env.TENANT_ROOT_DOMAIN,
    process.env.DENALI_WALLET_ADMIN_HOST,
    process.env.DENALI_WALLET_PORTAL_HOST,
    process.env.DENALI_WALLET_NON_PILOT_ADMIN_HOST,
  ];
  return configuredValues.every((value) => {
    const normalized = value?.trim().toLowerCase();
    return (
      normalized === undefined ||
      !PRODUCTION_MARKERS.some((marker) => normalized.includes(marker))
    );
  });
}
