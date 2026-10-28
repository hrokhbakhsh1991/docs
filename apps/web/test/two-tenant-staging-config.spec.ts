import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  defineTwoTenantStagingConfig,
  validateTwoTenantStagingManifest,
} from "./fixtures/two-tenant-staging-config.mts";

const validManifest = () => ({
  version: 1,
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
});

describe("two-tenant staging manifest", () => {
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
    const directory = mkdtempSync(join(tmpdir(), "denali-two-tenant-config-"));
    const manifestPath = join(directory, "manifest.json");
    const oldManifestPath = process.env.DENALI_TWO_TENANT_STAGING_MANIFEST;
    const oldRunId = process.env.DENALI_TWO_TENANT_RUN_ID;
    const oldTestSha = process.env.DENALI_TWO_TENANT_TEST_SHA;
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
      writeFileSync(manifestPath, JSON.stringify(validManifest()));
      process.env.DENALI_TWO_TENANT_STAGING_MANIFEST = manifestPath;
      process.env.DENALI_TWO_TENANT_RUN_ID = `config-test-${process.pid}-${Date.now()}`;
      process.env.DENALI_TWO_TENANT_TEST_SHA = "b".repeat(40);
      const config = defineTwoTenantStagingConfig({
        use: {
          ignoreHTTPSErrors: true,
          launchOptions: {
            args: ["--ignore-certificate-errors", "--disable-web-security"],
          },
        },
      });
      const launchArgs = config.use?.launchOptions?.args ?? [];
      assert.equal(process.env.PW_EXTERNAL_SERVERS, "1");
      const tenantOriginMap = JSON.parse(process.env.TENANT_SURFACE_ORIGIN_MAP_JSON ?? "null");
      assert.equal(tenantOriginMap.tenants[1].cookieDomain, "qa2.staging.test");
      assert.equal(config.use?.baseURL, "https://staging-admin-denali.shenski.com");
      assert.equal(config.use?.ignoreHTTPSErrors, false);
      assert.equal(config.use?.screenshot, "only-on-failure");
      assert.equal(config.use?.trace, "retain-on-failure");
      assert.equal(config.outputDir?.endsWith(process.env.DENALI_TWO_TENANT_RUN_ID), true);
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
      if (process.env.DENALI_TWO_TENANT_RUN_ID) {
        rmSync(
          join(
            process.cwd(),
            "test-results/two-tenant-staging",
            process.env.DENALI_TWO_TENANT_RUN_ID
          ),
          { recursive: true, force: true }
        );
      }
      if (oldManifestPath === undefined) delete process.env.DENALI_TWO_TENANT_STAGING_MANIFEST;
      else process.env.DENALI_TWO_TENANT_STAGING_MANIFEST = oldManifestPath;
      if (oldRunId === undefined) delete process.env.DENALI_TWO_TENANT_RUN_ID;
      else process.env.DENALI_TWO_TENANT_RUN_ID = oldRunId;
      if (oldTestSha === undefined) delete process.env.DENALI_TWO_TENANT_TEST_SHA;
      else process.env.DENALI_TWO_TENANT_TEST_SHA = oldTestSha;
      if (oldExternalServers === undefined) delete process.env.PW_EXTERNAL_SERVERS;
      else process.env.PW_EXTERNAL_SERVERS = oldExternalServers;
      if (oldTenantOriginMap === undefined) delete process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
      else process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = oldTenantOriginMap;
      for (const envName of hostEnvNames) {
        const value = oldHostEnv[envName];
        if (value === undefined) delete process.env[envName];
        else process.env[envName] = value;
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
