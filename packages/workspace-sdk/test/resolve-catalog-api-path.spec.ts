import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveCatalogListApiPath,
  resolveCatalogTourApiPath,
  UnknownCatalogPluginError,
} from "../src/catalog/resolve-catalog-api-path";

describe("resolve-catalog-api-path", () => {
  it("SDK-CAT-01 resolves denali list path", () => {
    assert.equal(resolveCatalogListApiPath("denali"), "/denali/catalog");
  });

  it("SDK-CAT-02 resolves urban list path", () => {
    assert.equal(resolveCatalogListApiPath("urban"), "/urban/catalog");
  });

  it("SDK-CAT-03 unknown plugin throws", () => {
    assert.throws(() => resolveCatalogListApiPath("starter"), UnknownCatalogPluginError);
  });

  it("SDK-CAT-04 tour detail path encodes id", () => {
    assert.equal(
      resolveCatalogTourApiPath("denali", "00000000-0000-4000-8000-000000000210"),
      "/denali/catalog/00000000-0000-4000-8000-000000000210"
    );
  });
});
