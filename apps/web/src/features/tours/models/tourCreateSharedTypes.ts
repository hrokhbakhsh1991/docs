import { z } from "zod";

/** Picked from Settings → Locations; persisted under `tripDetails.overview` + `cost_context.location` (override). */
export interface TourLocationSectionModel {
  regionId?: string;
  mainDestinationId?: string;
  secondaryDestinationIdsRaw?: string;
  displayLocationOverride?: string;
}

export const tourLocationSectionSchema = z.object({
  regionId: z.string().trim().optional().default(""),
  mainDestinationId: z.string().trim().optional().default(""),
  secondaryDestinationIdsRaw: z.string().trim().optional(),
  displayLocationOverride: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export const SOCIAL_PLATFORMS = ["telegram", "whatsapp", "instagram", "website", "other"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}
