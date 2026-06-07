import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .email()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

export const urbanRegistrationPostSchema = z.object({
  tourId: z.string().uuid(),
  contact: z.object({
    email: emailSchema,
    fullName: z.string().trim().min(1).max(200),
    phone: z
      .string()
      .trim()
      .max(32)
      .regex(/^[\d+\-().\s]*$/)
      .optional(),
  }),
  partySize: z.number().int().min(1).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type UrbanRegistrationPostBody = z.infer<typeof urbanRegistrationPostSchema>;

export function parseUrbanRegistrationPostBody(input: unknown): UrbanRegistrationPostBody {
  const parsed = urbanRegistrationPostSchema.safeParse(input);
  if (!parsed.success) {
    const err = new Error("ZOD_VALIDATION_FAILED");
    (err as Error & { details?: unknown }).details = parsed.error.flatten();
    throw err;
  }
  return parsed.data;
}
