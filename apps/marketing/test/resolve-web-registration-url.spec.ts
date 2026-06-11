import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePortalPublicBaseUrl,
  resolveWebRegistrationUrl,
  supportsCatalogRegistration,
} from "../src/portal/resolve-web-registration-url";

describe("resolve-web-registration-url", () => {
  it("MKT-07 urban and denali plugins support registration", () => {
    assert.equal(supportsCatalogRegistration("urban"), true);
    assert.equal(supportsCatalogRegistration("denali"), true);
    assert.equal(supportsCatalogRegistration("starter"), false);
  });

  it("MKT-08 marketing host maps to portal base", () => {
    assert.equal(
      resolvePortalPublicBaseUrl("shop.urban.localhost:3002"),
      "http://urban.localhost:3003"
    );
  });

  it("MKT-09 urban registration path on portal shell", () => {
    assert.equal(
      resolveWebRegistrationUrl("shop.urban.localhost:3002", "tour-abc", "urban"),
      "http://urban.localhost:3003/catalog/tour-abc/register"
    );
  });

  it("MKT-10 denali registration path on portal shell", () => {
    assert.equal(
      resolveWebRegistrationUrl("shop.operator.localhost:3002", "tour-abc", "denali"),
      "http://operator.localhost:3003/catalog/tour-abc/register"
    );
  });

  it("MKT-11 PORTAL_PUBLIC_BASE_URL override", () => {
    const prior = process.env.PORTAL_PUBLIC_BASE_URL;
    process.env.PORTAL_PUBLIC_BASE_URL = "https://portal.urban.example.com";
    try {
      assert.equal(
        resolveWebRegistrationUrl("shop.urban.localhost:3002", "t1", "urban"),
        "https://portal.urban.example.com/catalog/t1/register"
      );
    } finally {
      if (prior === undefined) {
        delete process.env.PORTAL_PUBLIC_BASE_URL;
      } else {
        process.env.PORTAL_PUBLIC_BASE_URL = prior;
      }
    }
  });
});
