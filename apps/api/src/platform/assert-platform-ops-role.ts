import type { PlatformAuthContext } from "./platform-auth-context.ts";
import { PlatformForbidden } from "./platform.errors.ts";

export function assertPlatformOpsWriteRole(ctx: PlatformAuthContext) {
  if (!ctx || !Array.isArray(ctx.roles)) throw new PlatformForbidden("no roles");
  if (ctx.roles.includes("admin") || ctx.roles.includes("owner")) return true;
  throw new PlatformForbidden("insufficient role");
}

export function assertPlatformOpsOwnerRole(ctx: PlatformAuthContext) {
  if (!ctx || !Array.isArray(ctx.roles)) throw new PlatformForbidden("no roles");
  if (ctx.roles.includes("owner")) return true;
  throw new PlatformForbidden("owner only");
}
