import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildExposureFieldCatalog,
  buildExposureSelectableFieldCatalog,
  DELIVERABLE_REGISTRY_TAG,
  exposureCatalogFieldIds,
  exposureSelectableFieldIds,
} from "./exposure-field-catalog";

describe("exposure field catalog", () => {
  it("lists Denali registry fields from the exposure module", () => {
    const catalog = buildExposureFieldCatalog("denali");
    const catalogIds = catalog.map((field) => field.id);

    assert.ok(catalog.length > 1);
    assert.ok(catalogIds.includes("title"));
    assert.ok(catalogIds.includes("denali.destination"));
  });

  it("filters selectable fields by deliverable registry tag only", () => {
    const fullCatalog = buildExposureFieldCatalog("denali");
    const selectable = buildExposureSelectableFieldCatalog("denali");

    assert.ok(selectable.length > 0);
    assert.ok(selectable.length < fullCatalog.length);
    assert.ok(selectable.every((field) => field.tags?.includes(DELIVERABLE_REGISTRY_TAG)));
    assert.deepEqual(
      exposureSelectableFieldIds("denali"),
      selectable.map((field) => field.id),
    );
    assert.deepEqual(
      exposureCatalogFieldIds("denali"),
      fullCatalog.map((field) => field.id),
    );
  });

  it("returns empty catalogs for unknown workspace types", () => {
    assert.deepEqual(buildExposureFieldCatalog("unknown-workspace"), []);
    assert.deepEqual(buildExposureSelectableFieldCatalog(null), []);
  });
});
