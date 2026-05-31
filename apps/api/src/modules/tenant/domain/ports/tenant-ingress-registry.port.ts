import type { TenantEntity } from "../../../identity/entities/tenant.entity";

export const TENANT_INGRESS_REGISTRY_PORT = Symbol("TENANT_INGRESS_REGISTRY_PORT");

export interface TenantIngressRegistryPort {
  invalidateCustomDomainCaches(input: {
    hostname?: string | null;
    webOrigin?: string | null;
  }): Promise<void>;

  resolveTenantEntityByCustomHostname(hostname: string): Promise<TenantEntity | null>;

  isRegisteredWebOrigin(origin: string): Promise<boolean>;
}
