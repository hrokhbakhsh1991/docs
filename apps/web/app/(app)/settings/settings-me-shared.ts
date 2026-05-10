import type { MePendingEmailVerificationWire, MeProfileGenderWire } from "@repo/types";

import type { WorkspaceMeData } from "./workspace-me-provider";

export type ProfileGenderFormValue = "" | MeProfileGenderWire;

export function isPendingEmailVerification(body: unknown): body is MePendingEmailVerificationWire {
  return (
    body !== null &&
    typeof body === "object" &&
    "status" in body &&
    (body as { status?: string }).status === "pending_email_verification" &&
    typeof (body as { profile_row_version?: unknown }).profile_row_version === "number"
  );
}

function profileGenderFromMe(g: WorkspaceMeData["gender"]): ProfileGenderFormValue {
  if (g === "female" || g === "male" || g === "non_binary" || g === "prefer_not_to_say") {
    return g;
  }
  return "";
}

export function mapMeToProfileForm(me: WorkspaceMeData): {
  fullName: string;
  notificationsEnabled: boolean;
  nationalId: string;
  gender: ProfileGenderFormValue;
  birthDate: string;
} {
  return {
    fullName: typeof me.full_name === "string" ? me.full_name : "",
    /** Tri-state notifications: unchecked until user explicitly opted in (`true`). */
    notificationsEnabled: me.notifications_enabled === true,
    nationalId:
      typeof me.national_id === "string" && me.national_id.trim() !== "" ? me.national_id.trim() : "",
    gender: profileGenderFromMe(me.gender),
    birthDate: typeof me.birth_date === "string" ? me.birth_date : "",
  };
}

export function mapMeToEmailForm(me: WorkspaceMeData): { email: string } {
  return {
    email: typeof me.email === "string" ? me.email : ""
  };
}
