import type { useRouter } from "next/navigation";

type AppRouter = ReturnType<typeof useRouter>;

const DEFAULT_POST_LOGIN_PATH = "/dashboard";
const DEFAULT_POST_LOGOUT_PATH = "/auth/login";

/** Safe in-app path from `returnUrl` query param (open-redirect guard). */
export function resolveAuthReturnPath(
  search: string,
  fallback = DEFAULT_POST_LOGIN_PATH
): string {
  const returnUrl = new URLSearchParams(search).get("returnUrl");
  if (
    returnUrl !== null &&
    returnUrl.startsWith("/") &&
    !returnUrl.startsWith("//")
  ) {
    return returnUrl;
  }
  return fallback;
}

/**
 * Soft navigation after HttpOnly session cookie changes.
 * `push` updates the URL; `refresh` re-fetches RSC layouts with the new cookie
 * (middleware + `(app)/layout` session gate) without a full document reload.
 */
export function navigateAfterAuthSessionChange(
  router: AppRouter,
  targetPath: string
): void {
  router.push(targetPath);
  router.refresh();
}

export function navigateAfterLogin(router: AppRouter, search: string): void {
  navigateAfterAuthSessionChange(
    router,
    resolveAuthReturnPath(search, DEFAULT_POST_LOGIN_PATH)
  );
}

export function navigateAfterLogout(router: AppRouter): void {
  navigateAfterAuthSessionChange(router, DEFAULT_POST_LOGOUT_PATH);
}
