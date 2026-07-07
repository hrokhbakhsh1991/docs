export const PLATFORM_SESSION_COOKIE = "platform_session";
export const PLATFORM_SESSION_MAX_AGE_SECONDS = 604_800;

export type PlatformOpsSessionPayload = {
  readonly phone: string;
  readonly role: "owner" | "admin" | "support";
};
