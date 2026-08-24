import type { WorkspacePricingFieldRegistryFragment } from "@app-tour/workspace-sdk";

import { denaliRegistryPresentationFields } from "./denali-integration-field-presentation";
import { DENALI_PRICING_PAYMENT_ANCHOR_PATH } from "./denali-pricing-tour-field-module";

/**
 * CW7-11 — workspace field-registry slice bound via manifest `fieldModule`.
 * Base price renders inside denali.pricing-payment composite (INV-WIZ-002).
 */
export const denaliPricingFieldRegistryFragment: WorkspacePricingFieldRegistryFragment =
  Object.freeze({
    version: 1,
    fields: Object.freeze([
      Object.freeze({
        id: "denali.pricing-payment",
        canonicalPath: DENALI_PRICING_PAYMENT_ANCHOR_PATH,
        stepId: "denali_pricing",
        kind: "boolean" as const,
        required: false,
        tags: ["core", "deliverable"] as const,
        ...denaliRegistryPresentationFields({
          id: "denali.pricing-payment",
          canonicalPath: DENALI_PRICING_PAYMENT_ANCHOR_PATH,
          tags: ["core", "deliverable"],
        }),
      }),
    ]),
  });

export {
  DENALI_BASE_PRICE_CANONICAL_PATH,
  DENALI_PRICING_PAYMENT_ANCHOR_PATH,
  denaliPricingFieldModule,
} from "./denali-pricing-tour-field-module";
