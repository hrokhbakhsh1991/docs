import type { WorkspaceUserDto } from "@/lib/services/users.service";

/** Resolved avatar glyph bucket — always safe to render. */
export type AvatarDisplayGender = "male" | "female" | "neutral";

/**
 * Fail-safe gender resolution: null, empty, unknown, `prefer_not_to_say`, and `non_binary`
 * all map to the neutral placeholder (no runtime branch on invalid API values).
 */
export function resolveAvatarDisplayGender(
  gender: WorkspaceUserDto["gender"] | string | null | undefined
): AvatarDisplayGender {
  if (gender === null || gender === undefined) {
    return "neutral";
  }
  if (typeof gender !== "string") {
    return "neutral";
  }
  const normalized = gender.trim().toLowerCase();
  if (normalized === "") {
    return "neutral";
  }
  if (normalized === "male") {
    return "male";
  }
  if (normalized === "female") {
    return "female";
  }
  return "neutral";
}
