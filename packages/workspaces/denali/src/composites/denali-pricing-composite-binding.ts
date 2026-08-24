import {
  WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH,
  type WorkspacePricingWizardCompositeBinding,
} from "@app-tour/workspace-sdk";

import {
  DENALI_BASE_PRICE_CANONICAL_PATH,
  DENALI_PRICING_PAYMENT_ANCHOR_PATH,
} from "../field-registry/denali-pricing-tour-field-module";

/** CW7-11 — wizard composite metadata for manifest `workspacePricing.wizardComposite`. */
export const denaliPricingWizardCompositeBinding: WorkspacePricingWizardCompositeBinding =
  Object.freeze({
    rendererId: "denali.pricing-payment",
    anchorCanonicalPath: DENALI_PRICING_PAYMENT_ANCHOR_PATH,
    basePriceCanonicalPath: DENALI_BASE_PRICE_CANONICAL_PATH,
  });

export { WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH };
