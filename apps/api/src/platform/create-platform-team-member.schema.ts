import { z } from "zod";

import { PlatformValidation } from "./platform.errors.ts";

const PLATFORM_OPS_ROLES = ["owner", "admin", "support"] as const;

export const createPlatformTeamMemberSchema = z
  .object({
    phone: z.string().trim().min(8),
    role: z.enum(PLATFORM_OPS_ROLES),
  })
  .strict();

export type CreatePlatformTeamMemberBody = z.infer<typeof createPlatformTeamMemberSchema>;

export function parseCreatePlatformTeamMemberBody(raw: unknown): CreatePlatformTeamMemberBody {
  const parsed = createPlatformTeamMemberSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PlatformValidation(parsed.error.message);
  }
  return parsed.data;
}
