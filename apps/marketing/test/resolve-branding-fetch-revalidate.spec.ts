import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_TENANT_BRAND_LOGO_SIGNED_URL_TTL_SECONDS,
  resolveBrandingFetchRevalidateSeconds,
} from "../src/tenant/resolve-branding-fetch-revalidate";

describe("resolve-branding-fetch-revalidate.spec.ts", () => {
  it("defaults to 60s and stays below half presign TTL", () => {
    assert.equal(resolveBrandingFetchRevalidateSeconds(undefined), 60);
    assert.equal(
      resolveBrandingFetchRevalidateSeconds(undefined),
      Math.min(60, Math.floor(PUBLIC_TENANT_BRAND_LOGO_SIGNED_URL_TTL_SECONDS / 2))
    );
  });

  it("caps env override to half presign TTL", () => {
    assert.equal(resolveBrandingFetchRevalidateSeconds("300"), 300);
    assert.equal(resolveBrandingFetchRevalidateSeconds("9999"), 1800);
  });

  it("falls back when env is invalid", () => {
    assert.equal(resolveBrandingFetchRevalidateSeconds("not-a-number"), 60);
    assert.equal(resolveBrandingFetchRevalidateSeconds("-1"), 60);
  });
});
