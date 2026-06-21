import { PlatformForbidden, PlatformUnauthorized, PlatformValidation } from "./platform.errors";

export function mapPlatformErrorToStatus(err: unknown): number | null {
  if (err instanceof PlatformUnauthorized) return 401;
  if (err instanceof PlatformForbidden) return 403;
  if (err instanceof PlatformValidation) return 422;
  return null;
}
