import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { readTenantBrandingInvalidBodyErrorCode } from "../src/tenant/tenant-branding.routes.ts";

const ROUTE_SOURCE = join(import.meta.dirname, "../src/tenant/tenant-branding.routes.ts");

describe("tenant-branding error map", () => {
  it("extracts safe invalid-body tokens without leaking message details", () => {
    assert.equal(
      readTenantBrandingInvalidBodyErrorCode("TENANT_BRAND_LOGO_CONTENT_TYPE_INVALID"),
      "TENANT_BRAND_LOGO_CONTENT_TYPE_INVALID"
    );
    assert.equal(
      readTenantBrandingInvalidBodyErrorCode("ALPINE_PHOTO_TENANT_MISMATCH: key=secret"),
      "ALPINE_PHOTO_TENANT_MISMATCH"
    );
    assert.equal(
      readTenantBrandingInvalidBodyErrorCode("DENALI_PHOTO_TENANT_MISMATCH: key=secret"),
      "DENALI_PHOTO_TENANT_MISMATCH"
    );
  });

  it("keeps tenant branding route free of Denali-specific photo branches", () => {
    const source = readFileSync(ROUTE_SOURCE, "utf8");

    assert.match(source, /readTenantBrandingInvalidBodyErrorCode/);
    assert.doesNotMatch(source, /startsWith\("DENALI_PHOTO_"\)/);
    assert.doesNotMatch(source, /code:\s*message/);
  });
});
