/** True only when unsigned `dev.<payload>` bearer is permitted (local scaffold). */
export function isDevBearerAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" && process.env.AUTH_ALLOW_DEV_BEARER === "true"
  );
}
