import { z } from "zod";

import {
  denaliRegistrationTransportIntakeSchema,
  denaliRegistrantTargetSchema,
} from "./denali-registration-transport.schema";

const optionalEmailSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .email()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  .optional();

const nationalIdSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/)
  .optional();

const fatherNameSchema = z.string().trim().min(1).max(200).optional();

const birthDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export const denaliRegistrationPostSchema = z.object({
  tourId: z.string().uuid(),
  registrantTarget: denaliRegistrantTargetSchema.optional(),
  contact: z.object({
    email: optionalEmailSchema,
    fullName: z.string().trim().min(1).max(200),
    phone: z
      .string()
      .trim()
      .max(32)
      .regex(/^[\d+\-().\s]*$/)
      .optional(),
    nationalId: nationalIdSchema,
    fatherName: fatherNameSchema,
    birthDate: birthDateSchema,
  }),
  partySize: z.number().int().min(1),
  transport: denaliRegistrationTransportIntakeSchema.optional(),
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
