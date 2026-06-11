/**
 * Marketing locale resolution (M13)
 * @see docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAppLocale } from "../src/i18n/resolve-app-locale";

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
