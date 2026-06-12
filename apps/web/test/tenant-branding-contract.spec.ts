/**
 * Tenant branding upload contracts.
 * @see docs/workspaces/tenant-branding.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "../../..");
const WEB_ROOT = join(import.meta.dirname, "..");

describe("tenant-branding-contract.spec.ts", () => {
  it("WEB-TENANT-BRANDING-01 settings module registered in denali manifest", () => {
    const manifest = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/settings/denali-settings.manifest.ts"),
      "utf8"
    );
    assert.match(manifest, /id: "workspace_branding"/);
    assert.match(manifest, /settings\/branding/);
  });

  it("WEB-TENANT-BRANDING-02 API routes wired in app.ts", () => {
    const app = readFileSync(join(REPO_ROOT, "apps/api/src/app.ts"), "utf8");
    assert.match(app, /\/settings\/branding\/logo/);
    assert.match(app, /\/public\/tenant-branding/);
    const dispatch = readFileSync(
      join(REPO_ROOT, "apps/api/src/openapi/dispatch-routes.ts"),
      "utf8"
    );
    assert.match(dispatch, /\/settings\/branding/);
    assert.match(dispatch, /\/public\/tenant-branding/);
  });

  it("WEB-TENANT-BRANDING-03 TenantBrandMark used in operator chrome", () => {
    const brand = readFileSync(
      join(import.meta.dirname, "../src/admin/shell/operator-brand.tsx"),
      "utf8"
    );
    assert.match(brand, /TenantBrandMark/);
    const bridge = readFileSync(
      join(import.meta.dirname, "../src/shell/wizard-bridge-shell.tsx"),
      "utf8"
    );
    assert.match(bridge, /TenantBrandMark/);
  });

  it("WEB-TENANT-BRANDING-04 public BFF forwards x-forwarded-host to API", () => {
    const route = readFileSync(
      join(WEB_ROOT, "app/api/public/tenant-branding/route.ts"),
      "utf8"
    );
    assert.match(route, /x-forwarded-host/);
  });

  it("WEB-TENANT-BRANDING-04b public BFF is middleware-public", () => {
    const middleware = readFileSync(join(import.meta.dirname, "../middleware.ts"), "utf8");
    assert.match(middleware, /\/api\/public\/tenant-branding/);
  });

  it("WEB-TENANT-BRANDING-05 registry + CASL docs list workspace_branding", () => {
    const registry = readFileSync(
      join(REPO_ROOT, "docs/phase-9/appendices/SETTINGS-MODULE-REGISTRY.md"),
      "utf8"
    );
    assert.match(registry, /`workspace_branding`/);
    assert.match(registry, /settings\/branding/);
    const casl = readFileSync(
      join(REPO_ROOT, "docs/phase-9/appendices/CASL-OPERATOR-SPEC.md"),
      "utf8"
    );
    assert.match(casl, /SDK-9\.6-04/);
    assert.match(casl, /workspace_branding/);
  });
});
