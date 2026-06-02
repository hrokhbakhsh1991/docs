export {};

declare global {
  namespace Express {
    interface Request {
      /** Resolved workspace tenant from inbound Host (subdomain); set by {@link TenantResolverMiddleware}. */
      tenant?: import("../modules/identity/entities/tenant.entity").TenantEntity;
    }
  }
}
