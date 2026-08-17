import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tryResolveCatalogRegistrationForTourApiPath } from "../src/catalog/resolve-catalog-registration-for-tour-api-path";

describe("tryResolveCatalogRegistrationForTourApiPath", () => {
  it("SDK-CAT-FORT-01 denali for-tour path encodes tour id", () => {
    assert.equal(
      tryResolveCatalogRegistrationForTourApiPath(
        "denali",
        "00000000-0000-4000-8000-000000000210"
      ),
      "/denali/registrations/for-tour/00000000-0000-4000-8000-000000000210"
    );
  });

  it("SDK-CAT-FORT-02 workspaces without for-tour return null", () => {
    assert.equal(tryResolveCatalogRegistrationForTourApiPath("urban", "tour-1"), null);
    assert.equal(tryResolveCatalogRegistrationForTourApiPath("harbor", "tour-1"), null);
    assert.equal(tryResolveCatalogRegistrationForTourApiPath("guest-club", "tour-1"), null);
    assert.equal(tryResolveCatalogRegistrationForTourApiPath("starter", "tour-1"), null);
  });

  it("SDK-CAT-FORT-03 blank tour id returns null", () => {
    assert.equal(tryResolveCatalogRegistrationForTourApiPath("denali", "  "), null);
  });
});
