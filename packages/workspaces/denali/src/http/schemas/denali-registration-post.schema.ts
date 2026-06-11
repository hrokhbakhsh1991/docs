import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .email()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

export const denaliRegistrationPostSchema = z.object({
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
  partySize: z.number().int().min(1),
});

export type DenaliRegistrationPostBody = z.infer<typeof denaliRegistrationPostSchema>;

export function parseDenaliRegistrationPostBody(input: unknown): DenaliRegistrationPostBody {
  const parsed = denaliRegistrationPostSchema.safeParse(input);
  if (!parsed.success) {
    const err = new Error("ZOD_VALIDATION_FAILED");
    (err as Error & { details?: unknown }).details = parsed.error.flatten();
    throw err;
  }
  return parsed.data;
}
