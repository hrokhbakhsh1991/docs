/**
 * Denali Wallet v1 — staging deployment guard logic (no secrets, no side effects).
 */
import {
  DENALI_WALLET_PILOT_SUBDOMAIN,
  DENALI_WALLET_PILOT_TENANT_ID,
  DENALI_WALLET_VERIFIED_RELEASE_PREFIX,
  DENALI_WALLET_VERIFIED_RELEASE_SHA,
  WALLET_STAGING_PRODUCTION_HOST_FRAGMENTS,
  WALLET_STAGING_PRODUCTION_PATH_FRAGMENTS,
  WALLET_STAGING_SECRET_ENV_KEYS,
} from "./wallet-staging-constants.mjs";

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ readonly ok: true } | { readonly ok: false; readonly errors: readonly string[] }}
 */
export function validateWalletStagingDeploy(env) {
  const errors = [];

  if (env.DENALI_WALLET_DEPLOY_TARGET?.trim() !== "staging") {
    errors.push("DENALI_WALLET_DEPLOY_TARGET must be exactly 'staging'");
  }

  if (env.DENALI_WALLET_STAGING_CONFIRM?.trim() !== "1") {
    errors.push("DENALI_WALLET_STAGING_CONFIRM=1 is required");
  }

  if (env.DENALI_WALLET_DEPLOY_DRY_RUN?.trim() !== "1") {
    if (
      env.DENALI_WALLET_EXECUTION_CONTEXT?.trim() === "vps" &&
      env.DENALI_WALLET_IS_ROOT?.trim() !== "1"
    ) {
      errors.push("wallet staging deploy on VPS must run as root");
    }
  }

  const envDir = env.ENV_DIR?.trim() ?? "";
  const deployRoot = env.DEPLOY_ROOT?.trim() ?? "";

  if (envDir.length === 0) {
    errors.push("ENV_DIR is required (expected /etc/app-tour-staging)");
  } else {
    if (!envDir.includes("staging")) {
      errors.push("ENV_DIR must reference staging (refusing production env paths)");
    }
    for (const fragment of WALLET_STAGING_PRODUCTION_PATH_FRAGMENTS) {
      if (envDir.includes(fragment) && !envDir.includes("staging")) {
        errors.push(`ENV_DIR matches production path fragment: ${fragment}`);
      }
    }
  }

  if (deployRoot.length === 0) {
    errors.push("DEPLOY_ROOT is required (expected /opt/app-tour-staging)");
  } else if (!deployRoot.includes("staging")) {
    errors.push("DEPLOY_ROOT must reference staging (refusing production deploy roots)");
  }

  for (const fragment of WALLET_STAGING_PRODUCTION_PATH_FRAGMENTS) {
    if (deployRoot === fragment || deployRoot.startsWith(`${fragment}/`)) {
      errors.push(`DEPLOY_ROOT matches production path: ${fragment}`);
    }
  }

  if (!env.DATABASE_URL?.trim()) {
    errors.push("DATABASE_URL is required");
  }
  if (!env.DATABASE_URL_ADMIN?.trim()) {
    errors.push("DATABASE_URL_ADMIN is required");
  }

  const storageDriver = env.STORAGE_DRIVER?.trim() ?? "";
  if (storageDriver !== "prisma") {
    errors.push("STORAGE_DRIVER must be prisma for Wallet staging deploy");
  }

  const pilotTenant = env.DENALI_WALLET_PILOT_TENANT_ID?.trim() || DENALI_WALLET_PILOT_TENANT_ID;
  const tenantCheck = validatePilotTenantId(pilotTenant);
  if (!tenantCheck.ok) {
    errors.push(...tenantCheck.errors);
  }

  if (env.DENALI_WALLET_BULK_TENANT_UPDATE?.trim() === "1") {
    errors.push("DENALI_WALLET_BULK_TENANT_UPDATE is forbidden — pilot tenant only");
  }

  if (env.DENALI_WALLET_ENABLE_ALL_TENANTS?.trim() === "1") {
    errors.push("DENALI_WALLET_ENABLE_ALL_TENANTS is forbidden");
  }

  const adminHost = env.DENALI_WALLET_ADMIN_HOST?.trim() ?? "";
  if (adminHost.length > 0) {
    errors.push(...validateStagingHostname(adminHost, "DENALI_WALLET_ADMIN_HOST"));
    if (!adminHost.toLowerCase().includes(DENALI_WALLET_PILOT_SUBDOMAIN)) {
      errors.push(
        `DENALI_WALLET_ADMIN_HOST must reference pilot subdomain ${DENALI_WALLET_PILOT_SUBDOMAIN}`
      );
    }
  }

  const portalHost = env.DENALI_WALLET_PORTAL_HOST?.trim() ?? "";
  if (portalHost.length > 0) {
    errors.push(...validateStagingHostname(portalHost, "DENALI_WALLET_PORTAL_HOST"));
    if (!portalHost.toLowerCase().includes(DENALI_WALLET_PILOT_SUBDOMAIN)) {
      errors.push(
        `DENALI_WALLET_PORTAL_HOST must reference pilot subdomain ${DENALI_WALLET_PILOT_SUBDOMAIN}`
      );
    }
  }

  const nonPilotHost = env.DENALI_WALLET_NON_PILOT_ADMIN_HOST?.trim() ?? "";
  if (nonPilotHost.length > 0) {
    errors.push(...validateStagingHostname(nonPilotHost, "DENALI_WALLET_NON_PILOT_ADMIN_HOST"));
    if (nonPilotHost.toLowerCase().includes(DENALI_WALLET_PILOT_SUBDOMAIN)) {
      errors.push("DENALI_WALLET_NON_PILOT_ADMIN_HOST must not be the pilot tenant host");
    }
  }

  const releaseSha = env.EXPECTED_RELEASE_SHA?.trim() ?? "";
  if (releaseSha.length > 0 && !releaseShaMatchesVerified(releaseSha)) {
    errors.push(
      `EXPECTED_RELEASE_SHA must match verified Wallet v1 release (${DENALI_WALLET_VERIFIED_RELEASE_PREFIX}…)`
    );
  }

  const isConfirmedStagingVps =
    env.DENALI_WALLET_DEPLOY_TARGET?.trim() === "staging" &&
    env.DENALI_WALLET_STAGING_CONFIRM?.trim() === "1" &&
    env.DENALI_WALLET_EXECUTION_CONTEXT?.trim() === "vps";

  if (env.DENALI_WALLET_SEED_PILOT?.trim() === "1") {
    const nodeEnv = env.NODE_ENV?.trim() ?? "";
    if (nodeEnv !== "development" && nodeEnv !== "test" && !(nodeEnv === "production" && isConfirmedStagingVps)) {
      errors.push(
        "DENALI_WALLET_SEED_PILOT requires NODE_ENV=development/test, or confirmed staging VPS production"
      );
    }
  }

  if (
    env.NODE_ENV?.trim() === "production" &&
    !isConfirmedStagingVps &&
    env.DENALI_WALLET_DEPLOY_DRY_RUN?.trim() !== "1"
  ) {
    errors.push("NODE_ENV=production is blocked unless deployment is confirmed staging on VPS");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

/**
 * @param {string} tenantId
 */
export function validatePilotTenantId(tenantId) {
  const normalized = tenantId.trim();
  if (normalized !== DENALI_WALLET_PILOT_TENANT_ID) {
    return {
      ok: false,
      errors: [
        `tenant id must be approved pilot ${DENALI_WALLET_PILOT_TENANT_ID} (got ${normalized})`,
      ],
    };
  }
  return { ok: true };
}

/**
 * @param {string} hostname
 * @param {string} label
 * @returns {string[]}
 */
export function validateStagingHostname(hostname, label) {
  const errors = [];
  const host = hostname.trim().toLowerCase();
  if (host.length === 0) {
    return errors;
  }

  for (const fragment of WALLET_STAGING_PRODUCTION_HOST_FRAGMENTS) {
    if (host.includes(fragment)) {
      errors.push(`${label} matches production hostname fragment: ${fragment}`);
    }
  }

  const isLocalCert =
    host.endsWith(".localhost") || host === "localhost" || host.includes(".localhost:");
  const isStagingSegment = host.includes(".staging.") || host.includes("staging.");
  if (!isLocalCert && !isStagingSegment) {
    errors.push(
      `${label} must include a staging segment or use *.localhost for certification`
    );
  }

  return errors;
}

/**
 * @param {string} sha
 */
export function releaseShaMatchesVerified(sha) {
  const normalized = sha.trim().toLowerCase();
  return (
    normalized === DENALI_WALLET_VERIFIED_RELEASE_SHA ||
    normalized.startsWith(DENALI_WALLET_VERIFIED_RELEASE_PREFIX)
  );
}

/**
 * @param {string} key
 * @param {string} value
 */
export function sanitizeLogValue(key, value) {
  const upper = key.toUpperCase();
  for (const secretKey of WALLET_STAGING_SECRET_ENV_KEYS) {
    if (upper.includes(secretKey)) {
      return "<redacted>";
    }
  }
  if (/postgres(ql)?:\/\//i.test(value) || /BEGIN (RSA |EC )?PRIVATE KEY/.test(value)) {
    return "<redacted>";
  }
  return value;
}

/**
 * @param {string} text
 */
export function containsTrackedSecretPattern(text) {
  if (/postgres(ql)?:\/\/[^\s'"]+:[^\s'"]+@/i.test(text)) {
    return true;
  }
  if (/BEGIN (RSA |EC )?PRIVATE KEY/.test(text)) {
    return true;
  }
  if (/AUTH_JWT_PRIVATE_KEY\s*=\s*["']?-----BEGIN/.test(text)) {
    return true;
  }
  if (/\botp\s*[:=]\s*["']?\d{4,8}/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function validateWalletStagingRollback(env) {
  const errors = [];

  if (env.DENALI_WALLET_DEPLOY_TARGET?.trim() !== "staging") {
    errors.push("DENALI_WALLET_DEPLOY_TARGET must be 'staging' for rollback");
  }
  if (env.DENALI_WALLET_ROLLBACK_CONFIRM?.trim() !== "1") {
    errors.push("DENALI_WALLET_ROLLBACK_CONFIRM=1 is required");
  }

  const pilotTenant = env.DENALI_WALLET_PILOT_TENANT_ID?.trim() || DENALI_WALLET_PILOT_TENANT_ID;
  const tenantCheck = validatePilotTenantId(pilotTenant);
  if (!tenantCheck.ok) {
    errors.push(...tenantCheck.errors);
  }

  if (!env.DATABASE_URL_ADMIN?.trim()) {
    errors.push("DATABASE_URL_ADMIN is required for rollback SQL");
  }

  const envDir = env.ENV_DIR?.trim() ?? "";
  if (!envDir.includes("staging")) {
    errors.push("ENV_DIR must reference staging for rollback");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}
