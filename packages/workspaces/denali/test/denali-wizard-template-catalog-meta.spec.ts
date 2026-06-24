import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveDenaliCompositeParentAnchor,
  resolveDenaliWizardTemplateCatalogFieldMeta,
} from "../src/settings/denali-wizard-template-catalog-meta";

describe("denali-wizard-template-catalog-meta.spec.ts", () => {
  const pricingStepPaths = [
    "pricing.requiresPayment",
    "participants.minimumAge",
    "participants.nationalIdRequired",
    "participants.minRequiredPeaks",
  ];

  it("DENALI-TPL-META-01 nationalIdRequired parent is participants composite section anchor", () => {
    const meta = resolveDenaliWizardTemplateCatalogFieldMeta(
      "participants.nationalIdRequired",
      "denali_pricing",
      pricingStepPaths
    );
    assert.equal(meta.parentCanonicalPath, "participants.minimumAge");
    assert.equal(meta.registryDefaultRequired, false);
    assert.equal(meta.matrixInjectedRequired, false);
  });

  it("DENALI-TPL-META-02 themeIds lists program content dependents", () => {
    const meta = resolveDenaliWizardTemplateCatalogFieldMeta(
      "program.themeIds",
      "denali_photos",
      ["program.themeIds", "photos"]
    );
    assert.deepEqual(meta.compositeChildPaths, [
      "program.shortDescription",
      "program.longDescription",
    ]);
    assert.equal(meta.isCompositeAnchor, true);
  });

  it("DENALI-TPL-META-03 shortDescription is matrix-injected required on photos step", () => {
    const meta = resolveDenaliWizardTemplateCatalogFieldMeta(
      "program.shortDescription",
      "denali_photos",
      ["program.themeIds"]
    );
    assert.equal(resolveDenaliCompositeParentAnchor("program.shortDescription"), "program.themeIds");
    assert.equal(meta.parentCanonicalPath, "program.themeIds");
    assert.equal(meta.matrixInjectedRequired, true);
  });

  it("DENALI-TPL-META-04 minimumAge is registry-required", () => {
    const meta = resolveDenaliWizardTemplateCatalogFieldMeta(
      "participants.minimumAge",
      "denali_pricing",
      pricingStepPaths
    );
    assert.equal(meta.registryDefaultRequired, true);
    assert.equal(meta.parentCanonicalPath, null);
  });
});
