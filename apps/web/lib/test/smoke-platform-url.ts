const DEFAULT_TEST_PLATFORM_BASE_URL = "http://workspace-test.localhost:3000";

/**
 * Canonical Playwright smoke / PR gate origin.
 * Prefer `TEST_PLATFORM_BASE_URL`; fall back to legacy `PW_BASE_URL`.
 */
export function resolveTestPlatformBaseUrl(): string {
  const raw =
    process.env.TEST_PLATFORM_BASE_URL?.trim() ||
    process.env.PW_BASE_URL?.trim() ||
    DEFAULT_TEST_PLATFORM_BASE_URL;
  return raw.replace(/\/$/, "");
}

/** Host label extracted from {@link resolveTestPlatformBaseUrl} (e.g. `workspace-test`). */
export function resolveTestPlatformHostLabel(): string {
  const hostname = new URL(resolveTestPlatformBaseUrl()).hostname;
  const label = hostname.split(".")[0]?.trim();
  return label || "workspace-test";
}

export { DEFAULT_TEST_PLATFORM_BASE_URL };
