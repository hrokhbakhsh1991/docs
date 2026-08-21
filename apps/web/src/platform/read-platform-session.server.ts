import { cookies } from "next/headers";

import {
  PLATFORM_SESSION_COOKIE,
  validatePlatformSessionToken,
  type PlatformOpsSessionPayload,
} from "./build-platform-session-cookie";

export async function readPlatformOpsSessionFromCookies(): Promise<PlatformOpsSessionPayload | null> {
  const cookieStore = await cookies();
  const validation = await validatePlatformSessionToken(
    cookieStore.get(PLATFORM_SESSION_COOKIE)?.value
  );
  return validation.status === "valid" ? validation.session : null;
}

export async function readPlatformOpsSessionFromRequest(
  req: Request
): Promise<PlatformOpsSessionPayload | null> {
  const header = req.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${PLATFORM_SESSION_COOKIE}=([^;]*)`));
  const validation = await validatePlatformSessionToken(match?.[1]);
  return validation.status === "valid" ? validation.session : null;
}
