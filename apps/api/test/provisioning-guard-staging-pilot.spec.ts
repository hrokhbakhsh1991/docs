import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProvisioningDevelopmentOnly,
  ProvisioningDevOnlyError,
} from "../src/internal/provisioning-guard";

const PILOT_TENANT_ID = "00000000-0000-4000-8000-000000000430";
const ENV_KEYS = [
  "NODE_ENV",
  "DENALI_WALLET_DEPLOY_TARGET",
  "DENALI_WALLET_EXECUTION_CONTEXT",
  "DENALI_WALLET_STAGING_CONFIRM",
  "DENALI_WALLET_SEED_PILOT",
  "DENALI_WALLET_PILOT_TENANT_ID",
  "ENV_DIR",
  "DEPLOY_ROOT",
  "PLATFORM_ROOT_DOMAIN",
  "TENANT_ROOT_DOMAIN",
  "DENALI_WALLET_ADMIN_HOST",
  "DENALI_WALLET_PORTAL_HOST",
  "DENALI_WALLET_NON_PILOT_ADMIN_HOST",
  "DENALI_WALLET_BULK_TENANT_UPDATE",
  "DENALI_WALLET_ENABLE_ALL_TENANTS",
] as const;

function withEnv(values: Record<string, string | undefined>, callback: () => void): void {
  const previous = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of ENV_KEYS) {
      if (key in values && values[key] !== undefined) process.env[key] = values[key];
      else delete process.env[key];
    }
    callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function stagingPilotEnv(): Record<string, string> {
  return {
    NODE_ENV: "production",
    DENALI_WALLET_DEPLOY_TARGET: "staging",
    DENALI_WALLET_EXECUTION_CONTEXT: "vps",
    DENALI_WALLET_STAGING_CONFIRM: "1",
    DENALI_WALLET_SEED_PILOT: "1",
    DENALI_WALLET_PILOT_TENANT_ID: PILOT_TENANT_ID,
    ENV_DIR: "/etc/app-tour-staging",
    DEPLOY_ROOT: "/opt/app-tour-staging",
  };
}

test("production without the explicit staging pilot contract is rejected", () => {
  withEnv({ NODE_ENV: "production" }, () => {
    assert.throws(() => assertProvisioningDevelopmentOnly(), ProvisioningDevOnlyError);
  });
});

test("valid VPS staging pilot context is accepted", () => {
  withEnv(stagingPilotEnv(), () => {
    assert.doesNotThrow(() =>
      assertProvisioningDevelopmentOnly({ stagingPilotTenantId: PILOT_TENANT_ID })
    );
  });
});

test("wrong tenant is rejected", () => {
  withEnv(
    {
      ...stagingPilotEnv(),
      DENALI_WALLET_PILOT_TENANT_ID: "00000000-0000-4000-8000-000000000431",
    },
    () => {
      assert.throws(
        () =>
          assertProvisioningDevelopmentOnly({
            stagingPilotTenantId: "00000000-0000-4000-8000-000000000431",
          }),
        ProvisioningDevOnlyError
      );
    }
  );
});

test("production target is rejected", () => {
  withEnv({ ...stagingPilotEnv(), DENALI_WALLET_DEPLOY_TARGET: "production" }, () => {
    assert.throws(
      () => assertProvisioningDevelopmentOnly({ stagingPilotTenantId: PILOT_TENANT_ID }),
      ProvisioningDevOnlyError
    );
  });
});

test("bulk enablement is rejected", () => {
  withEnv({ ...stagingPilotEnv(), DENALI_WALLET_BULK_TENANT_UPDATE: "1" }, () => {
    assert.throws(
      () => assertProvisioningDevelopmentOnly({ stagingPilotTenantId: PILOT_TENANT_ID }),
      ProvisioningDevOnlyError
    );
  });
});

test("wallet-ws1 and ordinary provisioning remain forbidden in production", () => {
  withEnv(stagingPilotEnv(), () => {
    assert.throws(() => assertProvisioningDevelopmentOnly(), ProvisioningDevOnlyError);
  });
});
