import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("guest bootstrap parity — P8-0-N-005 / P9-0-N-001 / P9-2-N-001", () => {
  it("marketing and portal delegate to resolveGuestSurfaceBootstrapForHost", () => {
    const marketing = readFileSync(
      join(repoRoot, "apps/marketing/src/tenant/resolve-marketing-bootstrap.ts"),
      "utf8"
    );
    const portal = readFileSync(
      join(repoRoot, "apps/portal/src/tenant/resolve-portal-bootstrap.ts"),
      "utf8"
    );
    const shared = readFileSync(
      join(repoRoot, "packages/guest-surface-host/src/resolve-guest-surface-bootstrap.ts"),
      "utf8"
    );
    for (const source of [marketing, portal]) {
      assert.match(source, /@app-tour\/guest-surface-host/);
      assert.match(source, /resolveGuestSurfaceBootstrapForHost/);
      assert.doesNotMatch(source, /hostname\.includes/);
    }
    assert.match(marketing, /MARKETING_TENANT_UNRESOLVED/);
    assert.match(portal, /PORTAL_TENANT_UNRESOLVED/);
    assert.match(shared, /resolveTenantIdFromDevHost/);
    assert.match(shared, /fetchPublicTenantContextForHost/);
    assert.match(shared, /isDevGuestHostAllowed/);
    assert.doesNotMatch(shared, /hostname\.includes/);
  });

  it("marketing and portal env re-export shared guest BFF API base", () => {
    for (const app of ["marketing", "portal"] as const) {
      const env = readFileSync(join(repoRoot, `apps/${app}/src/env.ts`), "utf8");
      assert.match(env, /@app-tour\/guest-surface-host/);
      assert.match(env, /resolveTourOpsApiBaseUrl/);
      assert.match(env, /assertGuestBffProductionConfig/);
    }
  });
});
