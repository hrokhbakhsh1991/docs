import { z } from "zod";

import { optionalTrimmedString } from "./wire-primitives";
import { TOUR_PAYMENT_MODE_WIRE_VALUES } from "./wire-constants";

export const costContextWireSchema = z
  .object({
    currency: z.string().length(3).optional(),
    totalCost: z.string().regex(/^\d+(\.\d+)?$/).optional(),
    location: optionalTrimmedString(2048),
    requiresPayment: z.boolean().optional(),
    paymentMode: z.enum(TOUR_PAYMENT_MODE_WIRE_VALUES).optional(),
  })
  .strict();

export type CostContextWire = z.infer<typeof costContextWireSchema>;
