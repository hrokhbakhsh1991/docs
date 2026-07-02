import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveCatalogListFeatures,
  UnknownCatalogPresentationPluginError,
} from "../src/catalog/resolve-catalog-list-features";

describe("resolve-catalog-list-features", () => {
  it("SDK-CAT-01 denali has no city filter", () => {
    assert.deepEqual(resolveCatalogListFeatures("denali"), { cityFilter: false });
  });

  it("SDK-CAT-02 urban enables city filter", () => {
    assert.deepEqual(resolveCatalogListFeatures("urban"), { cityFilter: true });
  });

  it("SDK-CAT-03 unknown plugin fails closed", () => {
    assert.throws(
      () => resolveCatalogListFeatures("starter"),
      UnknownCatalogPresentationPluginError
    );
  });
});
