import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import {
  DENALI_ALLOW_MEMBERSHIP_DISCOUNT_CANONICAL_PATH,
  DENALI_BASE_PRICE_CANONICAL_PATH,
  denaliPricingFieldModule,
} from "../src/field-registry/denali-pricing-tour-field-module";

describe("denali-pricing-parity.golden.spec (CW7-11/12)", () => {
  it("tour-field module matches denaliFieldRegistryData base-price row", () => {
    const basePriceRow = DENALI_FIELD_DEFINITIONS.find(
      (row) => row.canonicalPath === DENALI_BASE_PRICE_CANONICAL_PATH
    );
    assert.ok(basePriceRow);

    const fragmentField = denaliPricingFieldModule.fields.find(
      (field) => field.canonicalPath === DENALI_BASE_PRICE_CANONICAL_PATH
    );
    assert.ok(fragmentField);
    assert.equal(fragmentField.canonicalPath, basePriceRow.canonicalPath);
    assert.equal(fragmentField.stepId, basePriceRow.stepId);
    assert.equal(fragmentField.rhfPath, basePriceRow.rhfPath);
    assert.equal(fragmentField.zodPath, basePriceRow.zodPath);
    assert.equal(fragmentField.zodKind, basePriceRow.zodKind);
    assert.deepEqual(fragmentField.tags, basePriceRow.tags);
    assert.deepEqual(fragmentField.ruleDefaults, basePriceRow.ruleDefaults);
  });

  it("tour-field module matches denaliFieldRegistryData allowMembershipDiscount row (CW7-12)", () => {
    const gateRow = DENALI_FIELD_DEFINITIONS.find(
      (row) => row.canonicalPath === DENALI_ALLOW_MEMBERSHIP_DISCOUNT_CANONICAL_PATH
    );
    assert.ok(gateRow);

    const fragmentField = denaliPricingFieldModule.fields.find(
      (field) => field.canonicalPath === DENALI_ALLOW_MEMBERSHIP_DISCOUNT_CANONICAL_PATH
    );
    assert.ok(fragmentField);
    assert.equal(fragmentField.canonicalPath, gateRow.canonicalPath);
    assert.equal(fragmentField.stepId, gateRow.stepId);
    assert.equal(fragmentField.rhfPath, gateRow.rhfPath);
    assert.equal(fragmentField.zodPath, gateRow.zodPath);
    assert.equal(fragmentField.zodKind, gateRow.zodKind);
    assert.deepEqual(fragmentField.tags, gateRow.tags);
    assert.deepEqual(fragmentField.ruleDefaults, gateRow.ruleDefaults);
  });

  it("field module exposes workspacePricing.tourField id with both pricing rows", () => {
    assert.equal(denaliPricingFieldModule.moduleId, "workspacePricing.tourField");
    assert.equal(denaliPricingFieldModule.fields.length, 2);
  });
});
