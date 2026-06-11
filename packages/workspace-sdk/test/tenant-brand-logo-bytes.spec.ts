import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertTenantBrandLogoBytesMatchContentType,
  sniffTenantBrandLogoContentType,
} from "../src/theme/tenant-brand-logo-bytes";

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

describe("tenant-brand-logo-bytes.spec.ts", () => {
  it("sniffTenantBrandLogoContentType detects PNG", () => {
    assert.equal(sniffTenantBrandLogoContentType(PNG_HEADER), "image/png");
  });

  it("assertTenantBrandLogoBytesMatchContentType rejects header/body mismatch", () => {
    assert.throws(
      () => assertTenantBrandLogoBytesMatchContentType(PNG_HEADER, "image/jpeg"),
      /TENANT_BRAND_LOGO_BYTES_CONTENT_TYPE_MISMATCH/
    );
  });

  it("assertTenantBrandLogoBytesMatchContentType accepts matching PNG", () => {
    assert.doesNotThrow(() =>
      assertTenantBrandLogoBytesMatchContentType(PNG_HEADER, "image/png")
    );
  });
});
