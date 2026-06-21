import type { PlatformAuthContext } from "./platform-auth-context.ts";
import { PlatformForbidden, PlatformUnauthorized } from "./platform.errors.ts";
import type { PlatformOpsUserRepository } from "./platform-ops-user.repository.ts";
import { readPlatformOpsBearerToken } from "./read-platform-ops-bearer-token.ts";
import { resolvePlatformOpsPhoneAccess } from "./resolve-platform-ops-phone-access.ts";

function readBearerToken(authHeader: string): string {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function assertPlatformOpsAuth(
  headers: Record<string, string | undefined>,
  deps: { repository?: PlatformOpsUserRepository } = {}
): Promise<PlatformAuthContext> {
  const auth = headers["authorization"] || headers["Authorization"];
  if (!auth) throw new PlatformUnauthorized();
  const bearer = readBearerToken(String(auth));
  if (bearer.length === 0 || bearer !== readPlatformOpsBearerToken()) {
    throw new PlatformUnauthorized();
  }

  const phone = headers["x-platform-ops-phone"] || headers["X-Platform-Ops-Phone"];
  if (!phone) throw new PlatformUnauthorized();
  const normalizedPhone = String(phone);

  const access = await resolvePlatformOpsPhoneAccess(normalizedPhone, deps);
  if (access === null) {
    throw new PlatformForbidden();
  }

  return {
    actorId: normalizedPhone,
    roles: [access.role],
  };
}
