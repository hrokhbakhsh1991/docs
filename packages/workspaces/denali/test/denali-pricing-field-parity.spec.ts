import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeWorkspaceFieldRegistryWithPricingFragments } from "@app-tour/workspace-sdk";
import { resolveWorkspacePricingFieldRegistryFragment } from "../../../../apps/web/src/bootstrap/workspace-pricing-field-module-bindings.generated";
import { resolveWorkspacePricingWizardCompositeBinding } from "../../../../apps/web/src/bootstrap/workspace-pricing-wizard-composite-bindings.generated";

import { denaliPricingWizardCompositeBinding } from "../src/composites/denali-pricing-composite-binding";
import {
  denaliPricingFieldRegistryFragment,
  DENALI_PRICING_PAYMENT_ANCHOR_PATH,
} from "../src/field-registry/denali-pricing-field-module";
import { buildDenaliWorkspaceFieldRegistry } from "../src/denali-plugin-adapter";

describe("denali-pricing-field-parity (CW7-11)", () => {
  it("manifest fieldModule fragment contains pricing-payment composite anchor only", () => {
    assert.equal(denaliPricingFieldRegistryFragment.fields.length, 1);
    assert.equal(
      denaliPricingFieldRegistryFragment.fields[0]?.canonicalPath,
      DENALI_PRICING_PAYMENT_ANCHOR_PATH
    );
    assert.equal(denaliPricingFieldRegistryFragment.fields[0]?.id, "denali.pricing-payment");
  });

  it("fragment matches full registry pricing-payment anchor row (Denali parity golden)", () => {
    const fullRegistry = buildDenaliWorkspaceFieldRegistry();
    const anchorFromFull = fullRegistry.fields.find(
      (field) => field.canonicalPath === DENALI_PRICING_PAYMENT_ANCHOR_PATH
    );
    assert.ok(anchorFromFull);
    assert.deepEqual(denaliPricingFieldRegistryFragment.fields[0], anchorFromFull);
  });

  it("codegen binding resolves denali fragment; starter isolated", () => {
    const denaliFragment = resolveWorkspacePricingFieldRegistryFragment("denali");
    assert.ok(denaliFragment);
    assert.equal(denaliFragment?.fields.length, 1);
    assert.equal(resolveWorkspacePricingFieldRegistryFragment("starter"), undefined);
    assert.equal(resolveWorkspacePricingFieldRegistryFragment("urban"), undefined);
    assert.equal(resolveWorkspacePricingFieldRegistryFragment("guest-club"), undefined);
  });

  it("wizard composite binding resolves denali metadata", () => {
    const binding = resolveWorkspacePricingWizardCompositeBinding("denali");
    assert.deepEqual(binding, denaliPricingWizardCompositeBinding);
    assert.equal(binding?.rendererId, "denali.pricing-payment");
    assert.equal(binding?.anchorCanonicalPath, DENALI_PRICING_PAYMENT_ANCHOR_PATH);
    assert.equal(binding?.basePriceCanonicalPath, "pricing.basePricePerPerson");
    assert.equal(resolveWorkspacePricingWizardCompositeBinding("starter"), undefined);
  });

  it("merge seam replaces pricing-payment row without duplicating ids", () => {
    const base = buildDenaliWorkspaceFieldRegistry();
    const merged = mergeWorkspaceFieldRegistryWithPricingFragments(
      base,
      denaliPricingFieldRegistryFragment
    );
    assert.equal(merged.fields.length, base.fields.length);
    const anchorMerged = merged.fields.find(
      (field) => field.canonicalPath === DENALI_PRICING_PAYMENT_ANCHOR_PATH
    );
    assert.ok(anchorMerged);
    assert.deepEqual(anchorMerged, denaliPricingFieldRegistryFragment.fields[0]);
  });
});
