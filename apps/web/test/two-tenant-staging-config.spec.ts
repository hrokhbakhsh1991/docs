import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  assertStagingRunnerCheckoutClean,
  assertStagingTestShaMatchesCheckout,
  composeTwoTenantStagingConfig,
  reserveStagingRunOutputDirectory,
  type TwoTenantStagingManifest,
  validateTwoTenantStagingManifest,
} from "./fixtures/two-tenant-staging-config.mts";

const validManifest = () =>
  ({
    version: 1 as const,
    runtimeSha: "a".repeat(40),
    expectedIngressAddresses: ["89.42.210.252"],
    tenants: {
      A: {
        tenantId: "00000000-0000-4000-8000-000000000003",
        hosts: {
          marketing: "https://staging-denali.shenski.com",
          admin: "https://staging-admin-denali.shenski.com",
          portal: "https://staging-portal-denali.shenski.com",
        },
        cookieDomain: "shenski.com",
      },
      B: {
        tenantId: "f0ed9e65-2638-4351-847d-724f87ebbfce",
        hosts: {
          marketing: "https://qa2.staging.test",
          admin: "https://admin.qa2.staging.test",
          portal: "https://portal.qa2.staging.test",
        },
        cookieDomain: "qa2.staging.test",
      },
    },
  }) satisfies TwoTenantStagingManifest;

describe("two-tenant staging manifest", () => {
  it("requires the recorded test SHA to match the current checkout", () => {
    const sha = "a".repeat(40);
    assert.doesNotThrow(() => assertStagingTestShaMatchesCheckout(sha, sha));
    assert.throws(
      () => assertStagingTestShaMatchesCheckout(sha, "b".repeat(40)),
      /match the current Git checkout HEAD/
    );
  });

  it("rejects modified or untracked files in a staging runner checkout", () => {
    assert.doesNotThrow(() => assertStagingRunnerCheckoutClean(""));
    assert.throws(
      () => assertStagingRunnerCheckoutClean(" M apps/web/tests/e2e/example.spec.ts\n"),
      /requires a clean Git checkout/
    );
  });

  it("atomically reserves a run directory and permits only workers with its inherited nonce", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "two-tenant-run-reservation-"));
    const outputDir = join(tempDir, "run-1");
    const runEnvironment: NodeJS.ProcessEnv = {};

    try {
      reserveStagingRunOutputDirectory("run-1", outputDir, runEnvironment);
      assert.match(runEnvironment.DENALI_TWO_TENANT_RUN_NONCE ?? "", /^[a-f0-9]{64}$/);
      assert.doesNotThrow(() =>
        reserveStagingRunOutputDirectory("run-1", outputDir, runEnvironment)
      );

      rmSync(outputDir, { recursive: true, force: true });
      assert.doesNotThrow(() =>
        reserveStagingRunOutputDirectory("run-1", outputDir, runEnvironment)
      );
      assert.equal(existsSync(outputDir), true);

      assert.throws(
        () => reserveStagingRunOutputDirectory("run-1", outputDir, { TEST_WORKER_INDEX: "0" }),
        /already exists for run run-1/
      );
      assert.throws(
        () =>
          reserveStagingRunOutputDirectory("run-1", outputDir, {
            DENALI_TWO_TENANT_RUN_NONCE: "forged",
          }),
        /not owned by this Playwright run/
      );
      assert.throws(
        () =>
          reserveStagingRunOutputDirectory("run-1", outputDir, {
            DENALI_TWO_TENANT_RUN_NONCE: "another-run-nonce",
          }),
        /not owned by this Playwright run/
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("accepts six unique HTTPS staging origins with distinct tenant identities", () => {
    const manifest = validateTwoTenantStagingManifest(validManifest());
    assert.equal(manifest.tenants.A.tenantId, "00000000-0000-4000-8000-000000000003");
    assert.equal(manifest.tenants.B.tenantId, "f0ed9e65-2638-4351-847d-724f87ebbfce");
  });

  it("rejects equal tenant IDs", () => {
    const manifest = validManifest();
    manifest.tenants.B.tenantId = manifest.tenants.A.tenantId;
    assert.throws(() => validateTwoTenantStagingManifest(manifest), /different tenant IDs/);
  });

  it("rejects non-UUID tenant identities", () => {
    const manifest = validManifest();
    manifest.tenants.B.tenantId = "tenant-b";
    assert.throws(() => validateTwoTenantStagingManifest(manifest), /UUID tenantId/);
  });

  it("requires a non-empty allowlist of valid ingress IPs", () => {
    for (const addresses of [[], ["not-an-ip"]]) {
      const manifest = validManifest();
      manifest.expectedIngressAddresses = addresses;
      assert.throws(() => validateTwoTenantStagingManifest(manifest), /IP addresses/);
    }
  });

  it("rejects repeated origins across surfaces or tenants", () => {
    const manifest = validManifest();
    manifest.tenants.B.hosts.admin = manifest.tenants.A.hosts.admin;
    assert.throws(() => validateTwoTenantStagingManifest(manifest), /duplicate origin/);
  });

  it("rejects production hosts, insecure transport, and arbitrary ports", () => {
    for (const origin of [
      "https://denali.shenski.com",
      "https://attacker.staging-qa2.shenski.com",
      "http://staging-denali.shenski.com",
      "https://staging-denali.shenski.com:8443",
    ]) {
      const manifest = validManifest();
      manifest.tenants.A.hosts.marketing = origin;
      assert.throws(() => validateTwoTenantStagingManifest(manifest));
    }
  });

  it("rejects origin URLs with credentials, paths, queries, or fragments", () => {
    for (const origin of [
      "https://user:secret@staging-denali.shenski.com",
      "https://staging-denali.shenski.com/dashboard",
      "https://staging-denali.shenski.com/?debug=1",
      "https://staging-denali.shenski.com/#fragment",
    ]) {
      const manifest = validManifest();
      manifest.tenants.A.hosts.admin = origin;
      assert.throws(() => validateTwoTenantStagingManifest(manifest));
    }
  });

  it("uses external HTTPS origins and removes browser security bypass flags", () => {
    const runId = `config-test-${process.pid}-${Date.now()}`;
    const outputDir = join(tmpdir(), "denali-two-tenant-config", runId);
    const oldExternalServers = process.env.PW_EXTERNAL_SERVERS;
    const oldTenantOriginMap = process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
    const hostEnvNames = [
      "DENALI_STAGING_A_MARKETING_URL",
      "DENALI_STAGING_A_ADMIN_URL",
      "DENALI_STAGING_A_PORTAL_URL",
      "DENALI_STAGING_B_MARKETING_URL",
      "DENALI_STAGING_B_ADMIN_URL",
      "DENALI_STAGING_B_PORTAL_URL",
    ];
    const oldHostEnv = Object.fromEntries(hostEnvNames.map((name) => [name, process.env[name]]));
    try {
      const config = composeTwoTenantStagingConfig(
        {
          use: {
            ignoreHTTPSErrors: true,
            launchOptions: {
              args: ["--ignore-certificate-errors", "--disable-web-security"],
            },
          },
        },
        validManifest(),
        { runId, testSha: "b".repeat(40), outputDir }
      );
      const launchArgs = config.use?.launchOptions?.args ?? [];
      assert.equal(process.env.PW_EXTERNAL_SERVERS, "1");
      const tenantOriginMap = JSON.parse(process.env.TENANT_SURFACE_ORIGIN_MAP_JSON ?? "null");
      assert.equal(tenantOriginMap.tenants[1].cookieDomain, "qa2.staging.test");
      assert.equal(config.use?.baseURL, "https://staging-admin-denali.shenski.com");
      assert.equal(config.use?.ignoreHTTPSErrors, false);
      assert.equal(config.use?.screenshot, "only-on-failure");
      assert.equal(config.use?.trace, "retain-on-failure");
      assert.equal(config.outputDir, outputDir);
      assert.deepEqual(config.reporter?.[0], ["list"]);
      assert.match(String(config.reporter?.[1]?.[0]), /two-tenant-staging-result-reporter\.mjs$/);
      assert.equal(launchArgs.includes("--disable-web-security"), false);
      assert.equal(
        launchArgs.some((arg) => arg.startsWith("--ignore-certificate-errors")),
        false
      );
      assert.equal(launchArgs.includes("--allow-insecure-localhost"), false);
      assert.equal(
        launchArgs.some((arg) => arg.startsWith("--host-resolver-rules=")),
        false
      );
    } finally {
      if (oldExternalServers === undefined) delete process.env.PW_EXTERNAL_SERVERS;
      else process.env.PW_EXTERNAL_SERVERS = oldExternalServers;
      if (oldTenantOriginMap === undefined) delete process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
      else process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = oldTenantOriginMap;
      for (const envName of hostEnvNames) {
        const value = oldHostEnv[envName];
        if (value === undefined) delete process.env[envName];
        else process.env[envName] = value;
      }
    }
  });
});
