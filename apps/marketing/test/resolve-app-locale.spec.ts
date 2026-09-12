/**
 * Marketing locale resolution (M13)
 * @see docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAppLocale } from "../src/i18n/resolve-app-locale";
import {
  isMarketingLocaleExternalPath,
  resolveMarketingLocalePath,
  resolveMarketingTourDetailAuthModalHref,
  resolveMarketingTourDetailPath,
  resolveMarketingToursListPath,
} from "../src/i18n/routing";

describe("resolveAppLocale", () => {
  it("MKT-19 cookie wins over tenant default", () => {
    assert.equal(
      resolveAppLocale({ cookieLocale: "en", tenantDefaultLocale: "fa" }),
      "en"
    );
  });

  it("MKT-20 tenant default when no cookie", () => {
    assert.equal(
      resolveAppLocale({ cookieLocale: null, tenantDefaultLocale: "en" }),
      "en"
    );
  });

  it("MKT-21 invalid tenant default falls back to fa", () => {
    assert.equal(
      resolveAppLocale({ cookieLocale: null, tenantDefaultLocale: "de" }),
      "fa"
    );
  });
});

describe("resolveMarketingLocalePath", () => {
  it("MKT-31 maps default locale to unprefixed paths and English to /en", () => {
    assert.equal(resolveMarketingLocalePath("/tours", "fa"), "/tours");
    assert.equal(resolveMarketingLocalePath("/tours", "en"), "/en/tours");
    assert.equal(resolveMarketingLocalePath("/en/tours", "fa"), "/tours");
    assert.equal(resolveMarketingLocalePath("/en/tours/tour-1", "en"), "/en/tours/tour-1");
  });

  it("MKT-GX-01 passes through absolute portal egress URLs unchanged", () => {
    const portalTrips = "http://denali.portal.localhost:3003/me/registrations";
    assert.equal(isMarketingLocaleExternalPath(portalTrips), true);
    assert.equal(resolveMarketingLocalePath(portalTrips, "fa"), portalTrips);
    assert.equal(resolveMarketingLocalePath(portalTrips, "en"), portalTrips);
  });
});

describe("resolveMarketingToursListPath", () => {
  it("MKT-LOCALE-02 preserves locale on list paths and query strings", () => {
    assert.equal(resolveMarketingToursListPath("fa"), "/tours");
    assert.equal(resolveMarketingToursListPath("en"), "/en/tours");
    assert.equal(
      resolveMarketingToursListPath("en", { category: "trek" }),
      "/en/tours?category=trek"
    );
    assert.equal(
      resolveMarketingToursListPath("fa", { q: "damavand" }),
      "/tours?q=damavand"
    );
  });
});

describe("resolveMarketingTourDetailPath", () => {
  it("MKT-LOCALE-02 preserves locale on detail paths", () => {
    assert.equal(resolveMarketingTourDetailPath("tour-1", "fa"), "/tours/tour-1");
    assert.equal(resolveMarketingTourDetailPath("tour-1", "en"), "/en/tours/tour-1");
  });
});

describe("resolveMarketingTourDetailAuthModalHref", () => {
  it("MKT-AUTH-01 PDP modal fallback stays on marketing tour detail with auth=login", () => {
    assert.equal(
      resolveMarketingTourDetailAuthModalHref("tour-1", "fa"),
      "/tours/tour-1?auth=login"
    );
    assert.equal(
      resolveMarketingTourDetailAuthModalHref("tour-1", "en"),
      "/en/tours/tour-1?auth=login"
    );
    assert.doesNotMatch(
      resolveMarketingTourDetailAuthModalHref("tour-1", "fa"),
      /\/catalog\//
    );
  });
});
