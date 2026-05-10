import type { WorkspaceMeData } from "./workspace-me-provider";

export function isPendingEmailVerification(body: unknown): body is { status: "pending_email_verification" } {
  return (
    body !== null &&
    typeof body === "object" &&
    "status" in body &&
    (body as { status?: string }).status === "pending_email_verification"
  );
}

export function mapMeToProfileForm(me: WorkspaceMeData): { fullName: string; notificationsEnabled: boolean } {
  return {
    fullName: typeof me.full_name === "string" ? me.full_name : "",
    notificationsEnabled: me.notifications_enabled === true
  };
}

export function mapMeToEmailForm(me: WorkspaceMeData): { email: string } {
  return {
    email: typeof me.email === "string" ? me.email : ""
  };
}
