// DEPRECATED: DO NOT EDIT. AUTO-GENERATED.
/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: denaliFieldRegistryData.ts (+ denaliRuleMatrixRecipes.ts)
 * Run: pnpm --filter web generate:denali-wizard
 */

import { z } from "zod";

import { denaliGearItemSchema } from "./denaliGearItemSchema";
import { denaliGatheringPickupStationFormSchema } from "./denaliGatheringPickupStation.schema";
import {
  denaliTransportModeSchema,
  optionalInt,
  rejectZeroAmount,
} from "./denaliSchemaPrimitives";


export const denaliTransportSchema = z.object({
  adminCapacityApproval: z.boolean().optional(),
  allowPersonalCar: z.boolean().optional(),
  dongAmount: optionalInt("مقدار نمی‌تواند منفی باشد."),
  seatPreference: z.string().trim().optional(),
  transportCost: optionalInt("مقدار نمی‌تواند منفی باشد."),
  transportMode: denaliTransportModeSchema,
  transportNotes: z.string().trim().optional(),
});

export const denaliTripDetailsOverviewLogisticsSchema = z.object({
  customServiceLabels: z.array(z.string().trim()).default([]),
});

export const denaliParticipantGearSchema = z.object({
  gearItems: z.array(denaliGearItemSchema).optional(),
});

export const denaliTripDetailsLogisticsSchema = z.object({
  gatheringPoints: z.array(denaliGatheringPickupStationFormSchema).default([]),
}).default({ gatheringPoints: [] });

export function applyDenaliLogisticsSchemaRefinements(
  data: {
    transport: z.infer<typeof denaliTransportSchema>;
  },
  ctx: z.RefinementCtx,
): void {
  rejectZeroAmount(
    data.transport.transportCost,
    ctx,
    ["transport", "transportCost"],
    "هزینه حمل‌ونقل باید بیشتر از صفر باشد.",
  );
  rejectZeroAmount(
    data.transport.dongAmount,
    ctx,
    ["transport", "dongAmount"],
    "مبلغ دنگ باید بیشتر از صفر باشد.",
  );
}
