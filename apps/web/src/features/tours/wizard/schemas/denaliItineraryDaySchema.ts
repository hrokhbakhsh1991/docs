import { z } from "zod";

import { denaliLocationDataSchema } from "./denaliLocationDataSchema";

/** Minimal per-day photo ref (wizard + canonical submit). */
export const denaliItineraryDayPhotoSchema = z.object({
  id: z.string().trim(),
  url: z.string().trim(),
  filename: z.string().trim().optional(),
  size: z.number().int().min(0).optional(),
  mimeType: z.string().trim().optional(),
  uploadedAt: z.string().trim().optional(),
});

export type DenaliItineraryDayPhoto = z.infer<typeof denaliItineraryDayPhotoSchema>;

/** Form + canonical shared itinerary day row. */
export const denaliItineraryDayRowSchema = z.object({
  day: z.number().int().min(1),
  activities: z.string().trim(),
  locationText: z.string().trim().optional(),
  location: denaliLocationDataSchema.optional(),
  photos: z.array(denaliItineraryDayPhotoSchema).optional(),
});

export type DenaliItineraryDayRowForm = z.infer<typeof denaliItineraryDayRowSchema>;

/** Canonical submit — strict day row (photos optional, id+url minimum). */
export const denaliCanonicalItineraryDayRowSchema = z
  .object({
    day: z.number().int().min(1),
    activities: z.string().trim(),
    locationText: z.string().trim().optional(),
    location: denaliLocationDataSchema.optional(),
    photos: z.array(denaliItineraryDayPhotoSchema).optional(),
  })
  .strict();

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Optional approximate return clock time (24h HH:mm). */
export function optionalApproximateReturnTimeSchema() {
  return z
    .string()
    .trim()
    .optional()
    .refine((v) => v == null || v === "" || HH_MM_RE.test(v), {
      message: "زمان تقریبی بازگشت باید به‌صورت HH:mm باشد.",
    })
    .transform((v) => (v == null || v === "" ? undefined : v));
}
