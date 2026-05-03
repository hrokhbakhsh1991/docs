import { z } from "zod";

/**
 * Form values aligned with `TourDto` and UI lifecycle mapping (`draft` → DRAFT …).
 * Dates are HTML `input[type=date]` strings (`yyyy-mm-dd`).
 */
export const TourSchema = z
  .object({
    title: z.string().trim().min(2, "Title must be at least 2 characters."),
    description: z.string().default(""),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().default(""),
    totalCapacity: z.number().int().positive("Capacity must be a positive integer."),
    price: z.number().min(0, "Price must be 0 or greater."),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
  })
  .superRefine((data, ctx) => {
    const start = new Date(`${data.startDate}T12:00:00`);
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid start date.", path: ["startDate"] });
      return;
    }
    const endRaw = data.endDate?.trim();
    if (!endRaw) return;
    const end = new Date(`${endRaw}T12:00:00`);
    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid end date.", path: ["endDate"] });
      return;
    }
    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must not be before start date.",
        path: ["endDate"],
      });
    }
  });

export type TourFormInput = z.input<typeof TourSchema>;
export type TourFormValues = z.output<typeof TourSchema>;
