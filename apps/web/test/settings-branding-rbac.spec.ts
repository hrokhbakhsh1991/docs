/**
 * Phase 1 — branding settings RBAC + live chrome (TEMP tenant-branding-production-closure-roadmap)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");

describe("settings-branding-rbac.spec.ts", () => {
  it("WEB-BRANDING-RBAC-01 branding client gates mutations with isAdminOrOwnerRole", () => {
    const client = readFileSync(
      join(WEB_ROOT, "app/(app)/settings/branding/branding-settings-client.tsx"),
      "utf8"
    );
    assert.match(client, /isAdminOrOwnerRole\(session\.role\)/);
    assert.match(client, /const canManage =/);
    assert.match(client, /data-can-manage=/);
    assert.match(client, /readOnlyBanner/);
    assert.match(client, /readOnly=\{!canManage\}/);
  });

  it("WEB-BRANDING-RBAC-02 upload/remove/save hidden or guarded when !canManage", () => {
    const client = readFileSync(
      join(WEB_ROOT, "app/(app)/settings/branding/branding-settings-client.tsx"),
      "utf8"
    );
    assert.match(client, /\{canManage \? \(/);
    assert.match(client, /if \(!canManage\)/);
  });

  it("WEB-BRANDING-LIVE-01 invalidateBranding + router.refresh after mutate", () => {
    const client = readFileSync(
      join(WEB_ROOT, "app/(app)/settings/branding/branding-settings-client.tsx"),
      "utf8"
    );
    assert.match(client, /invalidateBranding/);
    assert.match(client, /router\.refresh\(\)/);
    assert.match(client, /notifyBrandingChanged/);
  });

  it("WEB-BRANDING-LIVE-02 TenantBrandingProvider wraps operator shell", () => {
    const shell = readFileSync(join(WEB_ROOT, "src/admin/shell/operator-shell.tsx"), "utf8");
    assert.match(shell, /TenantBrandingProvider/);
    const wizard = readFileSync(join(WEB_ROOT, "src/shell/wizard-bridge-shell.tsx"), "utf8");
    assert.match(wizard, /TenantBrandingProvider/);
  });

  it("WEB-BRANDING-LIVE-03 TenantBrandMark consumes shared branding context", () => {
    const mark = readFileSync(join(WEB_ROOT, "src/admin/shell/tenant-brand-mark.tsx"), "utf8");
    assert.match(mark, /useTenantBrandingOptional/);
    assert.match(mark, /branding\?\.logoUrl/);
    assert.doesNotMatch(mark, /\?v=|\&v=\$\{/);
  });

  it("WEB-BRANDING-LIVE-04 cross-shell logo cache dedupes fetch", () => {
    const context = readFileSync(join(WEB_ROOT, "src/tenant/tenant-branding-context.tsx"), "utf8");
    const cache = readFileSync(join(WEB_ROOT, "src/tenant/tenant-branding-logo-cache.ts"), "utf8");
    assert.match(context, /fetchTenantBrandingLogoShared/);
    assert.match(context, /fetchTenantBranding/);
    assert.match(context, /subscribeTenantBrandingLogoCache/);
    assert.match(cache, /bumpTenantBrandingLogoCache/);
  });

  it("WEB-BRANDING-LIVE-05 operator nav reads live displayName from context", () => {
    const brand = readFileSync(join(WEB_ROOT, "src/admin/shell/operator-brand.tsx"), "utf8");
    assert.match(brand, /useTenantBrandTitle/);
  });
});
