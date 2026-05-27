import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_CATALOG_LIST_PATH,
  publicCatalogDetailPath,
  publicCatalogRegisterPath,
} from "./paths";

test("public catalog paths", () => {
  assert.equal(PUBLIC_CATALOG_LIST_PATH, "/catalog");
  assert.equal(publicCatalogDetailPath("tour-1"), "/catalog/tour-1");
  assert.equal(publicCatalogDetailPath(" id/with space "), "/catalog/id%2Fwith%20space");
  assert.equal(publicCatalogRegisterPath("tour-1"), "/catalog/tour-1/register");
});
