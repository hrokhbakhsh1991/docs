import {
  resolveGuestSurfaceBootstrapForHost,
  type GuestSurfaceBootstrap,
  type ResolveGuestSurfaceBootstrapOptions,
} from "./resolve-guest-surface-bootstrap";

export type AdminSurfaceBootstrap = GuestSurfaceBootstrap;

export type AdminSurfaceUnresolvedError = "ADMIN_TENANT_UNRESOLVED";

export type ResolveAdminSurfaceBootstrapOptions = Omit<
  ResolveGuestSurfaceBootstrapOptions,
  "surface" | "unresolvedError"
> & {
  readonly unresolvedError?: AdminSurfaceUnresolvedError;
};

/** ASB-001 — admin bootstrap chain matches marketing/portal (dev map → tenant-context → dev fallback | throw). */
export async function resolveAdminBootstrapForHost(
  options: ResolveAdminSurfaceBootstrapOptions
): Promise<AdminSurfaceBootstrap> {
  return resolveGuestSurfaceBootstrapForHost({
    ...options,
    surface: "admin",
    unresolvedError: options.unresolvedError ?? "ADMIN_TENANT_UNRESOLVED",
  });
}
