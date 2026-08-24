import {
  WORKSPACE_PRICING_ALLOW_MEMBERSHIP_DISCOUNT_CANONICAL_PATH,
  WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH,
  defineWorkspacePricingFieldsFragment,
} from "@app-tour/workspace-sdk";

import type { DenaliCreateWizardStepId } from "../layout/stepIds";

import type { DenaliFieldDefinition } from "./denaliFieldRegistryData";

export const DENALI_BASE_PRICE_CANONICAL_PATH = WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH;
export const DENALI_ALLOW_MEMBERSHIP_DISCOUNT_CANONICAL_PATH =
  WORKSPACE_PRICING_ALLOW_MEMBERSHIP_DISCOUNT_CANONICAL_PATH;
export const DENALI_PRICING_PAYMENT_ANCHOR_PATH = "pricing.requiresPayment" as const;

export const denaliBasePriceField = Object.freeze({
  canonicalPath: DENALI_BASE_PRICE_CANONICAL_PATH,
  stepId: "denali_pricing" as DenaliCreateWizardStepId,
  rhfPath: "pricingPayment.basePricePerPerson",
  zodPath: "pricingPayment.basePricePerPerson",
  zodKind: "optionalInt",
  tags: ["core"] as const,
  ruleDefaults: { required: false, hidden: false },
  contextualVisibility: { kind: "whenTruthy" as const, watchCanonical: DENALI_PRICING_PAYMENT_ANCHOR_PATH },
  contextualRequired: { kind: "whenTruthy" as const, watchCanonical: DENALI_PRICING_PAYMENT_ANCHOR_PATH },
  structuralInvariant: { kind: "clearWhenNotVisible" as const },
}) satisfies DenaliFieldDefinition;

export const denaliAllowMembershipDiscountField = Object.freeze({
  canonicalPath: DENALI_ALLOW_MEMBERSHIP_DISCOUNT_CANONICAL_PATH,
  stepId: "denali_pricing" as DenaliCreateWizardStepId,
  rhfPath: "pricingPayment.allowMembershipDiscount",
  zodPath: "pricingPayment.allowMembershipDiscount",
  zodKind: "booleanOptional",
  tags: ["core"] as const,
  ruleDefaults: { required: false, hidden: false },
  contextualVisibility: { kind: "whenTruthy" as const, watchCanonical: DENALI_PRICING_PAYMENT_ANCHOR_PATH },
}) satisfies DenaliFieldDefinition;

/**
 * CW7-11/12 — tour-field configs bound via manifest `workspacePricing.fieldModule`.
 */
export const denaliPricingFieldModule = defineWorkspacePricingFieldsFragment([
  denaliBasePriceField,
  denaliAllowMembershipDiscountField,
]);

export { denaliBasePriceField as denaliBasePriceTourField };
