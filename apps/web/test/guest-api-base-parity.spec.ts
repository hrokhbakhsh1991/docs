/**
 * PSC-001 Phase 1a — web admin API base URL parity with guest-surface-host.
 * @see docs/standards/platform-surface-cohesion.mdoc
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("web guest API base parity — PSC-1a", () => {
  it("WEB-PSC-1a-01 tour-ops-api-base re-exports guest-surface-host resolver (Wave H.a)", () => {
    const source = readFileSync(
      join(repoRoot, "apps/web/src/platform/tour-ops-api-base.ts"),
      "utf8"
    );
    assert.match(source, /@app-tour\/guest-surface-host/);
    assert.match(source, /resolveTourOpsApiBaseUrl/);
    assert.doesNotMatch(source, /TOUR_OPS_API_URL_NOT_CONFIGURED/);
  });

  it("WEB-PSC-1a-01b urban-api-base product path is removed", () => {
    assert.equal(existsSync(join(repoRoot, "apps/web/src/urban/urban-api-base.ts")), false);
  });

  it("WEB-PSC-1a-02 tenant-context uses shared resolver (no local apiBaseUrl)", () => {
    const source = readFileSync(
      join(repoRoot, "apps/web/src/tenant/fetch-public-tenant-context.server.ts"),
      "utf8"
    );
    assert.match(source, /resolveTourOpsApiBaseUrl/);
    assert.doesNotMatch(source, /function apiBaseUrl\(\)/);
  });

  it("WEB-PSC-1a-03 tenant-theme uses shared resolver (no local apiBaseUrl)", () => {
    const source = readFileSync(
      join(repoRoot, "apps/web/src/tenant/fetch-tenant-theme.server.ts"),
      "utf8"
    );
    assert.match(source, /resolveTourOpsApiBaseUrl/);
    assert.match(source, /SESSION_TOKEN_COOKIE/);
    assert.match(source, /authorization = `Bearer \$\{sessionToken\}`/);
    assert.doesNotMatch(source, /function apiBaseUrl\(\)/);
  });
});

describe("web guest branding parity — PSC-1b", () => {
  it("WEB-PSC-1b-01 branding delegates guest-surface-host", () => {
    const source = readFileSync(
      join(repoRoot, "apps/web/src/tenant/fetch-public-tenant-branding.server.ts"),
      "utf8"
    );
    assert.match(source, /fetchGuestPublicTenantBrandingForHost/);
    assert.match(source, /resolveTourOpsApiBaseUrl/);
    assert.match(source, /assertGuestBffProductionConfig/);
    assert.doesNotMatch(source, /function apiBaseUrl\(\)/);
  });

  it("WEB-PSC-1b-03 public BFF route delegates server branding helper", () => {
    const source = readFileSync(
      join(repoRoot, "apps/web/app/api/public/tenant-branding/route.ts"),
      "utf8"
    );
    assert.match(source, /fetchPublicTenantBrandingForHost/);
    assert.doesNotMatch(source, /backendRes\.ok/);
    assert.doesNotMatch(source, /\/public\/tenant-branding`/);
  });
});

describe("web pluginId resolution — PSC-1c", () => {
  it("WEB-PSC-1c-01 tenant-kernel uses codegen map not hostname heuristics", () => {
    const source = readFileSync(
      join(repoRoot, "apps/web/src/tenant/tenant-kernel.shared.ts"),
      "utf8"
    );
    assert.match(source, /resolveDevPluginIdForTenantId/);
    assert.doesNotMatch(source, /hostname\.startsWith\("denali\."\)/);
    assert.doesNotMatch(source, /hostname\.startsWith\("urban\."\)/);
  });

  it("WEB-PSC-1c-02 smoke tenant UUIDs resolve denali/urban pluginId", async () => {
    const { resolveBootstrapPluginIdForTenant } = await import(
      "../src/tenant/tenant-kernel.shared"
    );
    assert.equal(
      resolveBootstrapPluginIdForTenant("00000000-0000-4000-8000-000000000003"),
      "denali"
    );
    assert.equal(
      resolveBootstrapPluginIdForTenant("00000000-0000-4000-8000-000000000014"),
      "denali"
    );
    assert.equal(
      resolveBootstrapPluginIdForTenant("00000000-0000-4000-8000-000000000004"),
      "urban"
    );
  });
});

describe("web catalog egress — PSC-1d", () => {
  it("WEB-PSC-1d-01 denali catalog package uses SDK path resolver (Wave H.c)", () => {
    const packageSot = readFileSync(
      join(repoRoot, "packages/workspaces/denali/src/catalog/fetch-denali-catalog-tour.ts"),
      "utf8"
    );
    assert.match(packageSot, /resolveCatalogTourApiPath/);
    assert.doesNotMatch(packageSot, /\/denali\/catalog/);
    assert.equal(existsSync(join(repoRoot, "apps/web/src/denali")), false);
  });

  it("WEB-PSC-1d-02 urban catalog package uses SDK path resolver (Wave H.b)", () => {
    const source = readFileSync(
      join(repoRoot, "packages/workspaces/urban/src/catalog/fetch-urban-catalog.ts"),
      "utf8"
    );
    assert.match(source, /resolveCatalogListApiPath/);
    assert.match(source, /resolveCatalogTourApiPath/);
    assert.doesNotMatch(source, /\/urban\/catalog/);
  });
});

describe("web dev host session profiles — PSC-2", () => {
  it("WEB-PSC-2-01 tenant-kernel imports dev profiles SoT (not inline map)", () => {
    const kernel = readFileSync(
      join(repoRoot, "apps/web/src/tenant/tenant-kernel.server.ts"),
      "utf8"
    );
    const profiles = readFileSync(
      join(repoRoot, "apps/web/src/tenant/dev-host-session-profiles.ts"),
      "utf8"
    );
    assert.match(kernel, /dev-host-session-profiles/);
    assert.doesNotMatch(kernel, /DEV_HOST_SESSION_PROFILES/);
    assert.match(profiles, /DEV_HOST_SESSION_PROFILES/);
    assert.match(profiles, /workspace-owner-smoke/);
  });
});
