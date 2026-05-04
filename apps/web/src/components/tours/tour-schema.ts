import { z } from "zod";

/**
 * Form values aligned with `TourDto` and UI lifecycle mapping (`draft` → DRAFT …).
 * Tour schedule dates are out of MVP scope and are not sent to the API.
 */
export const TourSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters."),
  description: z.string().default(""),
  totalCapacity: z.number().int().positive("Capacity must be a positive integer."),
  price: z.number().min(0, "Price must be 0 or greater."),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  communicationLink: z
    .string()
    .trim()
    .max(2048, "Link is too long.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type TourFormInput = z.input<typeof TourSchema>;
export type TourFormValues = z.output<typeof TourSchema>;
