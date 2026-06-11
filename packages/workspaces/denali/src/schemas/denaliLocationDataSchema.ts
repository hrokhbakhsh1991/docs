import { z } from "zod";

/** Canonical map pin / zone payload for Denali wizard location composites. */
export const denaliLocationDataSchema = z
  .object({
    label: z.string().trim().optional(),
    address: z.string().trim().optional(),
    latitude: z.number().finite().optional(),
    longitude: z.number().finite().optional(),
  })
  .passthrough();

export type DenaliLocationData = z.infer<typeof denaliLocationDataSchema>;
