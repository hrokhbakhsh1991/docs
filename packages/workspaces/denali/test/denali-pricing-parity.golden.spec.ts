import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import {
  DENALI_BASE_PRICE_CANONICAL_PATH,
  denaliPricingFieldModule,
} from "../src/field-registry/denali-pricing-tour-field-module";

describe("denali-pricing-parity.golden.spec (CW7-11)", () => {
  it("tour-field module matches denaliFieldRegistryData base-price row", () => {
    const basePriceRow = DENALI_FIELD_DEFINITIONS.find(
      (row) => row.canonicalPath === DENALI_BASE_PRICE_CANONICAL_PATH
    );
    assert.ok(basePriceRow);

    const fragmentField = denaliPricingFieldModule.fields[0];
    assert.equal(fragmentField.canonicalPath, basePriceRow.canonicalPath);
    assert.equal(fragmentField.stepId, basePriceRow.stepId);
    assert.equal(fragmentField.rhfPath, basePriceRow.rhfPath);
    assert.equal(fragmentField.zodPath, basePriceRow.zodPath);
    assert.equal(fragmentField.zodKind, basePriceRow.zodKind);
    assert.deepEqual(fragmentField.tags, basePriceRow.tags);
    assert.deepEqual(fragmentField.ruleDefaults, basePriceRow.ruleDefaults);
  });

  it("field module exposes workspacePricing.tourField id", () => {
    assert.equal(denaliPricingFieldModule.moduleId, "workspacePricing.tourField");
    assert.equal(denaliPricingFieldModule.fields.length, 1);
  });
});
