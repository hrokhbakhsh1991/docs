import type { PlatformAuthContext } from "./platform-auth-context.ts";
import { PlatformForbidden } from "./platform.errors.ts";

export function assertPlatformOpsImpersonateRole(ctx: PlatformAuthContext): true {
  if (!ctx?.roles?.length) throw new PlatformForbidden("no roles");
  const allowed = ctx.roles.some((r) => r === "owner" || r === "admin" || r === "support");
  if (!allowed) throw new PlatformForbidden("impersonate forbidden");
  return true;
}
