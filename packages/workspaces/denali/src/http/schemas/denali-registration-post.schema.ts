import { z } from "zod";
import {
  WORKSPACE_REGISTRATION_EMAIL_PATTERN,
  WORKSPACE_REGISTRATION_PHONE_PATTERN,
  parseWorkspaceZodOrThrow,
} from "@app-tour/workspace-sdk";

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
  .regex(WORKSPACE_REGISTRATION_EMAIL_PATTERN)
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
      .regex(WORKSPACE_REGISTRATION_PHONE_PATTERN)
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
  return parseWorkspaceZodOrThrow(denaliRegistrationPostSchema.safeParse(input));
}
