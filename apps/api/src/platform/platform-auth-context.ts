export type PlatformAuthContext = {
  actorId: string;
  roles: string[];
};

export function isPlatformWriteRole(ctx: PlatformAuthContext) {
  return ctx.roles.includes("owner") || ctx.roles.includes("admin");
}
