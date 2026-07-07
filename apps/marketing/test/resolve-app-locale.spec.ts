/**
 * Marketing locale resolution (M13)
 * @see docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAppLocale } from "../src/i18n/resolve-app-locale";
import { resolveMarketingLocalePath } from "../src/i18n/routing";

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
});
