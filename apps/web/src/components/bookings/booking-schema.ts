import { z } from "zod";

/**
 * UI-oriented booking form; maps to `BookingDto` (`participantFullName`, `tourId`, `participantNote`, …).
 * `participantEmail` + `seats` are UI form fields beyond strict public registration API.
 */
export const BookingSchema = z.object({
  participantName: z.string().trim().min(2, "Name must be at least 2 characters."),
  participantEmail: z.string().trim().email("Enter a valid email."),
  tourId: z.string().min(1, "Choose a tour."),
  seats: z.number().int().min(1, "At least one seat."),
  note: z.string().default(""),
});

export type BookingFormInput = z.input<typeof BookingSchema>;
export type BookingFormValues = z.output<typeof BookingSchema>;
