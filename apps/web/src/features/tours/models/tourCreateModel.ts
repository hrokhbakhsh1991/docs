import { z } from "zod";

/**
 * MVP payload aligned with `CreateTourDto` (`apps/web/lib/services/tours.service.ts`).
 * Dates are not sent on create in the current API contract.
 */
export interface TourCreateModel {
  title: string;
  description?: string;
  location?: string;
  /** Telegram / communication URL; sent as `chat_link` on create. */
  communicationLink?: string;
  capacity: number;
  price: number;
  lifecycle_status: "Draft" | "Open";
}

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
