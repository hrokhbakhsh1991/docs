/**
 * Phase 5 — login tenant brand plugin-aware fallback
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");

describe("login-tenant-brand.spec.ts", () => {
  it("WEB-BRANDING-LOGIN-01 login page passes pluginId from host bootstrap", () => {
    const page = readFileSync(join(WEB_ROOT, "app/auth/login/page.tsx"), "utf8");
    assert.match(page, /resolveBootstrapAppSessionForHost/);
    assert.match(page, /pluginId=\{bootstrap\.session\.pluginId\}/);
  });

  it("WEB-BRANDING-LOGIN-02 LoginTenantBrand uses TenantBrandFallbackMark", () => {
    const loginBrand = readFileSync(
      join(WEB_ROOT, "src/features/auth/login-tenant-brand.tsx"),
      "utf8"
    );
    assert.match(loginBrand, /useLocale/);
    assert.match(loginBrand, /x-tenant-locale/);
    assert.match(loginBrand, /displayNameFa\?\.trim\(\)/);
    assert.match(loginBrand, /displayNameEn\?\.trim\(\)/);
    assert.match(loginBrand, /TenantBrandFallbackMark/);
    assert.match(loginBrand, /pluginId/);
    assert.doesNotMatch(loginBrand, /DenaliLogoMark/);
    assert.doesNotMatch(loginBrand, /workspaceFallback/);
    assert.match(loginBrand, /data-login-tenant-brand-logo/);
  });

  it("WEB-BRANDING-LOGIN-04 login page SSR-hydrates public branding", () => {
    const page = readFileSync(join(WEB_ROOT, "app/auth/login/page.tsx"), "utf8");
    const form = readFileSync(join(WEB_ROOT, "app/auth/login/login-form.tsx"), "utf8");
    assert.match(page, /fetchPublicTenantBrandingForHost/);
    assert.match(form, /initialBranding/);
    assert.doesNotMatch(form, /inviteOnlyFooter/);
  });

  it("WEB-BRANDING-LOGIN-03 TenantBrandMark shares fallback component", () => {
    const mark = readFileSync(join(WEB_ROOT, "src/admin/shell/tenant-brand-mark.tsx"), "utf8");
    assert.match(mark, /TenantBrandFallbackMark/);
  });

  it("WEB-BRANDING-VALIDATION-01 client validates logo file before upload", () => {
    const client = readFileSync(
      join(WEB_ROOT, "app/(app)/settings/branding/branding-settings-client.tsx"),
      "utf8"
    );
    assert.match(client, /validateTenantBrandLogoFile/);
    const validator = readFileSync(
      join(WEB_ROOT, "src/features/settings/validate-tenant-brand-logo-file.ts"),
      "utf8"
    );
    assert.match(validator, /TENANT_BRAND_LOGO_MAX_BYTES/);
    assert.match(validator, /isTenantBrandLogoContentType/);
  });
});
