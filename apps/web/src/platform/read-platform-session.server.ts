import { cookies } from "next/headers";

import {
  PLATFORM_SESSION_COOKIE,
  validatePlatformSessionToken,
  type PlatformOpsSessionPayload,
} from "./build-platform-session-cookie";

export async function readPlatformOpsSessionFromCookies(): Promise<PlatformOpsSessionPayload | null> {
  const cookieStore = await cookies();
  const validation = validatePlatformSessionToken(cookieStore.get(PLATFORM_SESSION_COOKIE)?.value);
  return validation.status === "valid" ? validation.session : null;
}

export function readPlatformOpsSessionFromRequest(req: Request): PlatformOpsSessionPayload | null {
  const header = req.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${PLATFORM_SESSION_COOKIE}=([^;]*)`));
  const validation = validatePlatformSessionToken(match?.[1]);
  return validation.status === "valid" ? validation.session : null;
}
