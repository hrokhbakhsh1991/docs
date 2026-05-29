// DEPRECATED: DO NOT EDIT. AUTO-GENERATED.
/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: denaliFieldRegistryData.ts (+ denaliRuleMatrixRecipes.ts)
 * Run: pnpm --filter web generate:denali-wizard
 */

import { z } from "zod";

import {
  optionalInt,
  optionalPositiveInt,
  rejectZeroAmount,
} from "./denaliSchemaPrimitives";


export const denaliPricingPaymentSchema = z.object({
  basePricePerPerson: optionalInt("مقدار نمی‌تواند منفی باشد."),
  includesTourInsurance: z.boolean().optional(),
  paymentMode: z.literal("offline_receipt").optional(),
  requiresPayment: z.boolean().optional(),
});

export const denaliParticipantRequirementsSchema = z.object({
  fitnessLevel: z.enum(["low", "medium", "high"]).optional(),
  fitnessPrerequisiteText: z.string().trim().optional(),
  maximumAge: optionalInt("مقدار نمی‌تواند منفی باشد."),
  minimumAge: optionalInt("مقدار نمی‌تواند منفی باشد."),
  minRequiredPeaks: z.number().int().min(1).max(4).optional(),
  nationalIdRequired: z.boolean().optional(),
  sportsInsuranceRequired: z.boolean().optional(),
});

export const denaliPoliciesSchema = z.object({
  cancellationDeadlineHours: optionalPositiveInt(1),
  cancellationPenaltyPercentage: optionalInt("مقدار نمی‌تواند منفی باشد."),
  policiesText: z.string().trim().optional(),
});

export const denaliTripDetailsOverviewPricingSchema = z.object({
  nonAttendanceDetails: z.string().trim().optional(),
});

export function applyDenaliPricingSchemaRefinements(
  data: {
    pricingPayment: z.infer<typeof denaliPricingPaymentSchema>;
  },
  ctx: z.RefinementCtx,
): void {
  if (data.pricingPayment.requiresPayment === true) {
    rejectZeroAmount(
      data.pricingPayment.basePricePerPerson,
      ctx,
      ["pricingPayment", "basePricePerPerson"],
      "قیمت باید بیشتر از صفر باشد.",
    );
  }
}
