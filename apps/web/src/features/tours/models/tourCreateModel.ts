import { z } from "zod";

/**
 * MVP payload aligned with `CreateTourDto` (`apps/web/lib/services/tours.service.ts`).
 * Dates are not sent on create in the current API contract.
 */
export interface TourCreateModel {
  title: string;
  description?: string;
  location?: string;
  socialLinks?: SocialLink[];
  autoAcceptRegistrations: boolean;
  tourType?: TourType;
  primaryTransportMode?: PrimaryTransportMode;
  /** Telegram / communication URL; sent as `chat_link` on create. */
  communicationLink?: string;
  capacity: number;
  price: number;
  lifecycle_status: "Draft" | "Open";
}

export const SOCIAL_PLATFORMS = ["telegram", "whatsapp", "instagram", "website", "other"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export const TOUR_TYPES = ["camp", "mountain", "city", "desert", "other"] as const;
export type TourType = (typeof TOUR_TYPES)[number];

export const PRIMARY_TRANSPORT_MODES = ["bus", "train", "plane", "private_car", "mixed", "none"] as const;
export type PrimaryTransportMode = (typeof PRIMARY_TRANSPORT_MODES)[number];

/** Cleared `<input type="number">` yields `""`; coercing via `Number("")` would be `0`, so force NaN instead. */
function emptyNumberInputToNaN(raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) {
    return Number.NaN;
  }
  return raw;
}

export const TourCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().optional(),
  location: z.string().trim().optional(),
  socialLinks: z
    .array(
      z.object({
        platform: z.enum(SOCIAL_PLATFORMS),
        url: z.string().trim().max(2048, "Link is too long.").url("Enter a valid URL."),
      }),
    )
    .optional(),
  autoAcceptRegistrations: z.boolean().default(true),
  tourType: z.enum(TOUR_TYPES).optional(),
  primaryTransportMode: z.enum(PRIMARY_TRANSPORT_MODES).optional(),
  communicationLink: z
    .string()
    .trim()
    .max(2048, "Link is too long.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  capacity: z.preprocess(
    emptyNumberInputToNaN,
    z.coerce
      .number()
      .refine((n) => Number.isFinite(n), { message: "Enter a valid capacity." })
      .int("Capacity must be a whole number.")
      .positive("Capacity must be at least 1."),
  ),
  price: z.preprocess(
    emptyNumberInputToNaN,
    z.coerce
      .number()
      .refine((n) => Number.isFinite(n), { message: "Enter a valid price." })
      .min(0, "Price must be 0 or greater."),
  ),
  lifecycle_status: z.enum(["Draft", "Open"]),
}) satisfies z.ZodType<TourCreateModel>;

export type TourCreateFormInput = z.input<typeof TourCreateSchema>;
