// DEPRECATED: DO NOT EDIT. AUTO-GENERATED.
/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: denaliFieldRegistryData.ts (+ denaliRuleMatrixRecipes.ts)
 * Run: pnpm --filter web generate:denali-wizard
 */

import { z } from "zod";

import {
  applyDenaliCoreSchemaRefinements,
  denaliBasicInfoSchema,
  denaliPhotosSchema,
  denaliProgramNatureSchema,
  denaliTripDetailsMetricsSchema,
  denaliTripDetailsOverviewCoreSchema,
} from "./denaliCore.schema.generated";
import {
  applyDenaliLogisticsSchemaRefinements,
  denaliParticipantGearSchema,
  denaliTransportSchema,
  denaliTripDetailsLogisticsSchema,
  denaliTripDetailsOverviewLogisticsSchema,
} from "./denaliLogistics.schema.generated";
import {
  applyDenaliPricingSchemaRefinements,
  denaliParticipantRequirementsSchema,
  denaliPoliciesSchema,
  denaliPricingPaymentSchema,
  denaliTripDetailsOverviewPricingSchema,
} from "./denaliPricing.schema.generated";

const denaliTripDetailsOverviewSchema = denaliTripDetailsOverviewCoreSchema
  .merge(denaliTripDetailsOverviewLogisticsSchema)
  .merge(denaliTripDetailsOverviewPricingSchema);

const denaliParticipantRequirementsMergedSchema = denaliParticipantRequirementsSchema.merge(
  denaliParticipantGearSchema,
);

const denaliTourCreateObjectSchema = z.object({
  basicInfo: denaliBasicInfoSchema,
  programNature: denaliProgramNatureSchema,
  transport: denaliTransportSchema,
  pricingPayment: denaliPricingPaymentSchema,
  participantRequirements: denaliParticipantRequirementsMergedSchema,
  policies: denaliPoliciesSchema,
  photosData: denaliPhotosSchema,
  tripDetails: z.object({
    logistics: denaliTripDetailsLogisticsSchema,
    overview: denaliTripDetailsOverviewSchema,
    metrics: denaliTripDetailsMetricsSchema,
  }).default({
    logistics: { gatheringPoints: [] },
    overview: { customServiceLabels: [] },
    metrics: {},
  }),
});

export const denaliTourCreateBaseSchema = denaliTourCreateObjectSchema.superRefine((data, ctx) => {
  applyDenaliCoreSchemaRefinements(data, ctx);
  applyDenaliLogisticsSchemaRefinements(data, ctx);
  applyDenaliPricingSchemaRefinements(data, ctx);
});

export type DenaliCreateTourWizardForm = z.infer<typeof denaliTourCreateBaseSchema>;
