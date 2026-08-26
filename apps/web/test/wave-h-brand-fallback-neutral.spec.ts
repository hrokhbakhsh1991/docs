/**
 * Wave H.e.a — Denali brand fallback mark neutralized in admin shell.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Wave H.e.a — brand fallback neutralization", () => {
  it("H.e.a-01 denali-logo-mark shim is absent", () => {
    assert.equal(existsSync(join(WEB_ROOT, "src/admin/shell/denali-logo-mark.tsx")), false);
  });

  it("H.e.a-02 TenantBrandFallbackMark has no Denali product import or kind switch", () => {
    const source = readFileSync(
      join(WEB_ROOT, "src/admin/shell/tenant-brand-fallback-mark.tsx"),
      "utf8"
    );
    assert.doesNotMatch(source, /DenaliLogoMark|denali-logo-mark|workspace-denali/);
    assert.doesNotMatch(source, /fallbackMark\s*===\s*["']denali["']/);
    assert.doesNotMatch(source, /WORKSPACE_WIZARD_CUSTOM_BRAND_FALLBACK_MARKS/);
    assert.match(source, /data-tenant-brand-icon-fallback/);
    assert.match(source, /resolveWizardCustomBrandFallbackMark/);
  });
});
