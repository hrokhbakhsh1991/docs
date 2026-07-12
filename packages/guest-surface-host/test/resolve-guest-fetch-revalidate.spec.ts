import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_TENANT_BRAND_LOGO_SIGNED_URL_TTL_SECONDS,
  resolveGuestBootstrapRevalidateSeconds,
  resolveGuestBrandingRevalidateSeconds,
} from "../src/resolve-guest-fetch-revalidate";

describe("resolveGuestBootstrapRevalidateSeconds", () => {
  it("defaults to 60s", () => {
    assert.equal(resolveGuestBootstrapRevalidateSeconds(undefined), 60);
  });

  it("honors env override", () => {
    assert.equal(resolveGuestBootstrapRevalidateSeconds("120"), 120);
  });

  it("falls back when env is invalid", () => {
    assert.equal(resolveGuestBootstrapRevalidateSeconds("not-a-number"), 60);
    assert.equal(resolveGuestBootstrapRevalidateSeconds("-1"), 60);
  });
});

describe("resolveGuestBrandingRevalidateSeconds", () => {
  it("defaults to 60s and stays below half presign TTL", () => {
    assert.equal(resolveGuestBrandingRevalidateSeconds(undefined), 60);
    assert.equal(
      resolveGuestBrandingRevalidateSeconds(undefined),
      Math.min(60, Math.floor(PUBLIC_TENANT_BRAND_LOGO_SIGNED_URL_TTL_SECONDS / 2))
    );
  });

  it("caps env override to half presign TTL", () => {
    assert.equal(resolveGuestBrandingRevalidateSeconds("300"), 300);
    assert.equal(resolveGuestBrandingRevalidateSeconds("9999"), 1800);
  });

  it("falls back when env is invalid", () => {
    assert.equal(resolveGuestBrandingRevalidateSeconds("not-a-number"), 60);
    assert.equal(resolveGuestBrandingRevalidateSeconds("-1"), 60);
  });

  it("reads legacy MARKETING_BRANDING_REVALIDATE_SECONDS when guest env unset", () => {
    const priorGuest = process.env.GUEST_BRANDING_REVALIDATE_SECONDS;
    const priorLegacy = process.env.MARKETING_BRANDING_REVALIDATE_SECONDS;
    process.env.GUEST_BRANDING_REVALIDATE_SECONDS = "";
    delete process.env.GUEST_BRANDING_REVALIDATE_SECONDS;
    process.env.MARKETING_BRANDING_REVALIDATE_SECONDS = "120";
    try {
      assert.equal(resolveGuestBrandingRevalidateSeconds(), 120);
    } finally {
      if (priorGuest === undefined) {
        delete process.env.GUEST_BRANDING_REVALIDATE_SECONDS;
      } else {
        process.env.GUEST_BRANDING_REVALIDATE_SECONDS = priorGuest;
      }
      if (priorLegacy === undefined) {
        delete process.env.MARKETING_BRANDING_REVALIDATE_SECONDS;
      } else {
        process.env.MARKETING_BRANDING_REVALIDATE_SECONDS = priorLegacy;
      }
    }
  });
});
