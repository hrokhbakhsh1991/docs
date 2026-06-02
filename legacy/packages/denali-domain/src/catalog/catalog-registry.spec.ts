import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogRegistry,
  OVERVIEW_TOUR_INSTANCE_PIN_FIELD_NAMES,
} from "./catalog-registry";

test("catalogRegistry resolves themeId from tourThemeIds container", () => {
  assert.equal(
    catalogRegistry.resolveReferenceKey({
      propertyName: "[]",
      parentPath: "overview.tourThemeIds",
      containerField: "tourThemeIds",
    }),
    "themeId",
  );
});

test("catalogRegistry resolves mediaId under gallery photos", () => {
  assert.equal(
    catalogRegistry.resolveReferenceKey({
      propertyName: "id",
      parentPath: "photos[0]",
    }),
    "mediaId",
  );
});

test("catalogRegistry classifies overview map pins as locationInstanceId", () => {
  for (const pinField of OVERVIEW_TOUR_INSTANCE_PIN_FIELD_NAMES) {
    assert.equal(
      catalogRegistry.resolveReferenceKey({
        propertyName: "id",
        parentPath: `overview.${pinField}`,
      }),
      "locationInstanceId",
      pinField,
    );
    assert.equal(catalogRegistry.shouldRemintOnClone("locationInstanceId"), true);
  }
});

test("catalogRegistry does not classify unknown overview fields as tour-instance location", () => {
  assert.equal(
    catalogRegistry.resolveReferenceKey({
      propertyName: "id",
      parentPath: "overview.customPin",
    }),
    null,
  );
});
