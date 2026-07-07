import type { PlatformOpsSessionPayload } from "./build-platform-session-cookie";

export const PLATFORM_LOGIN_PATH = "/auth/login" as const;

export type RequirePlatformOpsSessionParams = {
  readonly session: PlatformOpsSessionPayload | null;
  readonly pathname: string;
};

export type RequirePlatformOpsSessionResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly redirectTo: string };

export function isPlatformPublicPath(pathname: string): boolean {
  return pathname === PLATFORM_LOGIN_PATH || pathname.startsWith(`${PLATFORM_LOGIN_PATH}/`);
}

export function requirePlatformOpsSessionWeb(
  params: RequirePlatformOpsSessionParams
): RequirePlatformOpsSessionResult {
  if (isPlatformPublicPath(params.pathname)) {
    return { allowed: true };
  }
  if (params.session !== null) {
    return { allowed: true };
  }
  const returnUrl = encodeURIComponent(params.pathname);
  return {
    allowed: false,
    redirectTo: `${PLATFORM_LOGIN_PATH}?returnUrl=${returnUrl}`,
  };
}
