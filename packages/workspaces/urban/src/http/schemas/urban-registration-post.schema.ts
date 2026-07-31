import { z } from "zod";
import {
  WORKSPACE_REGISTRATION_EMAIL_PATTERN,
  WORKSPACE_REGISTRATION_PHONE_PATTERN,
  parseWorkspaceZodOrThrow,
} from "@app-tour/workspace-sdk";

const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .email()
  .regex(WORKSPACE_REGISTRATION_EMAIL_PATTERN);

export const urbanRegistrationPostSchema = z.object({
  tourId: z.string().uuid(),
  contact: z.object({
    email: emailSchema,
    fullName: z.string().trim().min(1).max(200),
    phone: z
      .string()
      .trim()
      .max(32)
      .regex(WORKSPACE_REGISTRATION_PHONE_PATTERN)
      .optional(),
  }),
  partySize: z.number().int().min(1).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type UrbanRegistrationPostBody = z.infer<typeof urbanRegistrationPostSchema>;

export function parseUrbanRegistrationPostBody(input: unknown): UrbanRegistrationPostBody {
  return parseWorkspaceZodOrThrow(urbanRegistrationPostSchema.safeParse(input));
}
