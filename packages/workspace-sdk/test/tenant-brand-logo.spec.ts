import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertTenantBrandLogoKeyTenantScope,
  buildTenantBrandLogoObjectKey,
  isTenantBrandLogoContentType,
  isTenantBrandLogoStorageKey,
} from "../src/theme/tenant-brand-logo";
import { validateTenantTheme } from "../src/theme/tenant-theme-validation";

const TENANT_ID = "00000000-0000-4000-8000-000000000014";

describe("tenant-brand-logo.spec.ts", () => {
  it("buildTenantBrandLogoObjectKey is tenant-scoped", () => {
    const key = buildTenantBrandLogoObjectKey(TENANT_ID);
    assert.equal(key, `${TENANT_ID}/branding/logo`);
    assert.equal(isTenantBrandLogoStorageKey(key), true);
    assert.throws(() => assertTenantBrandLogoKeyTenantScope(key, "00000000-0000-4000-8000-000000000099"));
  });

  it("isTenantBrandLogoContentType allows raster only", () => {
    assert.equal(isTenantBrandLogoContentType("image/png"), true);
    assert.equal(isTenantBrandLogoContentType("image/svg+xml"), false);
  });

  it("validateTenantTheme accepts logo metadata", () => {
    const key = buildTenantBrandLogoObjectKey(TENANT_ID);
    const theme = validateTenantTheme({
      displayName: "Alpine Club",
      logo: { storageKey: key, contentType: "image/png" },
    });
    assert.equal(theme.displayName, "Alpine Club");
    assert.equal(theme.logo?.storageKey, key);
  });
});
