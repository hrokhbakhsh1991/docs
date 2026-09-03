/**
 * Denali Wallet v1 staging deploy guard tests.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DENALI_WALLET_PILOT_TENANT_ID,
  DENALI_WALLET_VERIFIED_RELEASE_SHA,
} from "../vps-deploy/lib/wallet-staging-constants.mjs";
import {
  containsTrackedSecretPattern,
  releaseShaMatchesVerified,
  sanitizeLogValue,
  validatePilotTenantId,
  validateWalletStagingDeploy,
  validateWalletStagingRollback,
} from "../vps-deploy/lib/wallet-staging-guards.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function baseDeployEnv(overrides = {}) {
  return {
    DENALI_WALLET_DEPLOY_TARGET: "staging",
    DENALI_WALLET_STAGING_CONFIRM: "1",
    ENV_DIR: "/etc/app-tour-staging",
    DEPLOY_ROOT: "/opt/app-tour-staging",
    STORAGE_DRIVER: "prisma",
    DATABASE_URL: "postgres://placeholder",
    DATABASE_URL_ADMIN: "postgres://placeholder",
    ...overrides,
  };
}

describe("wallet-staging-deploy-guards", () => {
  it("WSD-01 accepts staging target with required env", () => {
    const result = validateWalletStagingDeploy(baseDeployEnv());
    assert.equal(result.ok, true);
  });

  it("WSD-02 rejects production deploy target", () => {
    const result = validateWalletStagingDeploy(
      baseDeployEnv({ DENALI_WALLET_DEPLOY_TARGET: "production" })
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /staging/);
  });

  it("WSD-03 rejects wrong pilot tenant id", () => {
    const tenant = validatePilotTenantId("00000000-0000-4000-8000-000000000003");
    assert.equal(tenant.ok, false);
    const deploy = validateWalletStagingDeploy(
      baseDeployEnv({ DENALI_WALLET_PILOT_TENANT_ID: "00000000-0000-4000-8000-000000000003" })
    );
    assert.equal(deploy.ok, false);
  });

  it("WSD-04 rejects missing DATABASE_URL_ADMIN", () => {
    const result = validateWalletStagingDeploy(
      baseDeployEnv({ DATABASE_URL_ADMIN: "", DATABASE_URL: "" })
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /DATABASE_URL/);
  });

  it("WSD-05 rejects non-prisma storage driver", () => {
    const result = validateWalletStagingDeploy(baseDeployEnv({ STORAGE_DRIVER: "memory" }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /prisma/);
  });

  it("WSD-06 enforces pilot-only seed (no bulk enable)", () => {
    const bulk = validateWalletStagingDeploy(
      baseDeployEnv({ DENALI_WALLET_BULK_TENANT_UPDATE: "1" })
    );
    assert.equal(bulk.ok, false);
    const seed = validateWalletStagingDeploy(
      baseDeployEnv({ DENALI_WALLET_SEED_PILOT: "1", NODE_ENV: "production" })
    );
    assert.equal(seed.ok, false);
    const okSeed = validateWalletStagingDeploy(
      baseDeployEnv({ DENALI_WALLET_SEED_PILOT: "1", NODE_ENV: "development" })
    );
    assert.equal(okSeed.ok, true);
  });

  it("WSD-07 rejects production hostnames", () => {
    const result = validateWalletStagingDeploy(
      baseDeployEnv({
        DENALI_WALLET_ADMIN_HOST: "admin.denali-wallet-pilot.denali.club",
        DENALI_WALLET_PORTAL_HOST: "portal.denali-wallet-pilot.staging.example.com",
      })
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /production hostname/);
  });

  it("WSD-08 rejects wrong application SHA and accepts verified artifact SHA", () => {
    assert.equal(releaseShaMatchesVerified(DENALI_WALLET_VERIFIED_RELEASE_SHA), true);
    assert.equal(releaseShaMatchesVerified("86ccdcc4"), true);
    assert.equal(releaseShaMatchesVerified("deadbeef"), false);
    assert.equal(
      validateWalletStagingDeploy(
        baseDeployEnv({ EXPECTED_RELEASE_SHA: "deadbeef" })
      ).ok,
      false
    );
    assert.equal(
      validateWalletStagingDeploy(
        baseDeployEnv({ EXPECTED_RELEASE_SHA: DENALI_WALLET_VERIFIED_RELEASE_SHA })
      ).ok,
      true
    );
  });

  it("WSD-09 rollback requires staging confirmation", () => {
    const ok = validateWalletStagingRollback({
      DENALI_WALLET_DEPLOY_TARGET: "staging",
      DENALI_WALLET_ROLLBACK_CONFIRM: "1",
      ENV_DIR: "/etc/app-tour-staging",
      DATABASE_URL_ADMIN: "postgres://placeholder",
      DENALI_WALLET_PILOT_TENANT_ID: DENALI_WALLET_PILOT_TENANT_ID,
    });
    assert.equal(ok.ok, true);
    const bad = validateWalletStagingRollback({
      DENALI_WALLET_DEPLOY_TARGET: "production",
      DENALI_WALLET_ROLLBACK_CONFIRM: "1",
      ENV_DIR: "/etc/app-tour-staging",
      DATABASE_URL_ADMIN: "postgres://placeholder",
    });
    assert.equal(bad.ok, false);
  });

  it("WSD-10 sanitizeLogValue redacts secret keys", () => {
    assert.equal(sanitizeLogValue("DATABASE_URL", "postgres://u:p@h/db"), "<redacted>");
    assert.equal(sanitizeLogValue("PORT", "3001"), "3001");
  });

  it("WSD-11 tracked deploy scripts contain no secret patterns", () => {
    const paths = [
      "scripts/vps-deploy/deploy-denali-wallet-staging.sh",
      "scripts/vps-deploy/verify-denali-wallet-staging.sh",
      "scripts/vps-deploy/rollback-denali-wallet-staging.sh",
      "scripts/vps-deploy/seed-denali-wallet-pilot-artifact.sh",
      "scripts/vps-deploy/lib/wallet-staging-guards.mjs",
      "scripts/vps-deploy/lib/wallet-staging-constants.mjs",
      "docs/phase-23/runbooks/denali-wallet-v1-staging-deploy.md",
    ];
    for (const rel of paths) {
      const text = read(rel);
      assert.equal(
        containsTrackedSecretPattern(text),
        false,
        `secret pattern found in ${rel}`
      );
    }
  });

  it("WSD-12 runbook documents VPS-side command and production block", () => {
    const doc = read("docs/phase-23/runbooks/denali-wallet-v1-staging-deploy.md");
    assert.match(doc, /DENALI_WALLET_DEPLOY_TARGET=staging/);
    assert.match(doc, /DENALI_WALLET_STAGING_CONFIRM=1/);
    assert.match(doc, /deploy-denali-wallet-staging\.sh/);
    assert.match(doc, /rollback-denali-wallet-staging\.sh/);
    assert.match(doc, /production.*refus/i);
    assert.match(doc, /certification dev servers/i);
  });
});
