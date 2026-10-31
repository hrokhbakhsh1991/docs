const STAGING_ENV_DIR = "/etc/app-tour-staging";
const STAGING_DEPLOY_ROOT = "/opt/app-tour-staging";
const STAGING_DATABASE = "tour_db_staging";
const STAGING_APP_ROLE = "app_tour";
const STAGING_ADMIN_ROLE = "postgres";
const STAGING_DATABASE_HOST_ALLOWLIST_ENV = "DENALI_SECOND_TENANT_STAGING_DATABASE_HOST_ALLOWLIST";
const APPLY_CONFIRMATIONS = {
  tenant: "provision-denali-qa2-to-tour_db_staging",
  identities: "seed-denali-qa2-identities-to-tour_db_staging",
  aIdentities: "seed-denali-a-identities-to-tour_db_staging",
  aIdentitiesCleanup: "cleanup-denali-a-identities-from-tour_db_staging",
  fixtures: "seed-denali-qa2-fixtures-to-tour_db_staging",
  cleanup: "cleanup-denali-qa2-fixtures-from-tour_db_staging",
} as const;
type StagingMutation = keyof typeof APPLY_CONFIRMATIONS;

export type SecondTenantStagingEnvironment = Readonly<Record<string, string | undefined>>;
type ParsedDatabaseUrl = Readonly<{
  database: string;
  hostname: string;
  port: string;
  username: string;
}>;

/** Validates the pinned staging target before a provisioning path may inspect or mutate it. */
export function assertSecondTenantStagingTarget(
  env: SecondTenantStagingEnvironment,
  apply = false,
  mutation: StagingMutation = "tenant"
): void {
  if (
    env.NODE_ENV !== "production" ||
    env.APP_INFRA_PROFILE !== "staging" ||
    env.ENV_DIR !== STAGING_ENV_DIR ||
    env.DEPLOY_ROOT !== STAGING_DEPLOY_ROOT
  ) {
    throw new Error("DENALI_SECOND_TENANT_STAGING_TARGET_REJECTED");
  }

  const appUrl = parseDatabaseUrl(env.DATABASE_URL);
  const adminUrl = parseDatabaseUrl(env.DATABASE_URL_ADMIN);
  const allowedDatabaseHosts = parseDatabaseHostAllowlist(env[STAGING_DATABASE_HOST_ALLOWLIST_ENV]);
  if (
    appUrl.database !== STAGING_DATABASE ||
    adminUrl.database !== STAGING_DATABASE ||
    appUrl.hostname !== adminUrl.hostname ||
    !allowedDatabaseHosts.has(appUrl.hostname) ||
    appUrl.port !== adminUrl.port ||
    appUrl.username !== STAGING_APP_ROLE ||
    adminUrl.username !== STAGING_ADMIN_ROLE ||
    env.STORAGE_DRIVER !== "prisma"
  ) {
    throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
  }

  const confirmationVariable =
    mutation === "tenant"
      ? "DENALI_SECOND_TENANT_STAGING_CONFIRM"
      : mutation === "identities"
        ? "DENALI_SECOND_TENANT_STAGING_IDENTITIES_CONFIRM"
        : mutation === "aIdentities"
          ? "DENALI_FIRST_STAGING_IDENTITIES_CONFIRM"
          : mutation === "aIdentitiesCleanup"
            ? "DENALI_FIRST_STAGING_IDENTITIES_CLEANUP_CONFIRM"
            : mutation === "fixtures"
              ? "DENALI_SECOND_TENANT_STAGING_FIXTURES_CONFIRM"
              : "DENALI_SECOND_TENANT_STAGING_CLEANUP_CONFIRM";
  if (apply && env[confirmationVariable] !== APPLY_CONFIRMATIONS[mutation]) {
    throw new Error("DENALI_SECOND_TENANT_STAGING_CONFIRMATION_REQUIRED");
  }
}

function parseDatabaseHostAllowlist(value: string | undefined): ReadonlySet<string> {
  if (value === undefined || value.trim().length === 0) {
    throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
  }

  const entries = value.split(",").map((entry) => entry.trim());
  if (entries.some((entry) => entry.length === 0)) {
    throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
  }

  const hosts = entries.map((entry) => {
    if (/[\s/@?#\\*%]/.test(entry)) {
      throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
    }

    let parsed: URL;
    try {
      parsed = new URL(`postgres://${entry}/`);
    } catch {
      throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname.length === 0 ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      parsed.port.length > 0 ||
      parsed.pathname !== "/" ||
      parsed.search.length > 0 ||
      parsed.hash.length > 0 ||
      hostname !== entry.toLowerCase()
    ) {
      throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
    }
    return hostname;
  });

  if (new Set(hosts).size !== hosts.length) {
    throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
  }
  return new Set(hosts);
}

function parseDatabaseUrl(value: string | undefined): ParsedDatabaseUrl {
  if (value === undefined || value.trim().length === 0) {
    throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const port = parsed.port || "5432";
  if (parsed.hostname.length === 0 || parsed.username.length === 0 || database.length === 0) {
    throw new Error("DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED");
  }
  return {
    database,
    hostname: parsed.hostname.toLowerCase(),
    port,
    username: decodeURIComponent(parsed.username),
  };
}
