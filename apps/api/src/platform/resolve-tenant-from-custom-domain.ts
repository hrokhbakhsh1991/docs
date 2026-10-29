import { PlatformDomainRepository } from "./platform-domain.repository.ts";
import { resolveSmokeCustomApexHost } from "./resolve-smoke-custom-apex-host.ts";
import { PlatformTenantRepository } from "./platform-tenant.repository.ts";
import { resolvePrivateStagingTenantHost } from "./resolve-private-staging-tenant-host.ts";

export async function resolveTenantFromCustomDomainHost(
  hostname: string,
  deps: {
    domainRepository?: PlatformDomainRepository;
    tenantRepository?: PlatformTenantRepository;
  } = {}
): Promise<{ tenantId: string; subdomain: string; surface: string } | null> {
  const smoke = resolveSmokeCustomApexHost(hostname);
  if (smoke !== null) {
    return smoke;
  }
  const domainRepository = deps.domainRepository ?? new PlatformDomainRepository();
  const privateStagingBinding = resolvePrivateStagingTenantHost(hostname);
  if (privateStagingBinding !== null) {
    // A private operator map must never take ownership of a hostname already
    // registered through the public custom-domain lifecycle.
    if (await domainRepository.findByHostname(hostname)) return null;
    const tenantRepository = deps.tenantRepository ?? new PlatformTenantRepository();
    const tenant = await tenantRepository.getById(privateStagingBinding.tenantId);
    if (!tenant || tenant.status !== "active") return null;
    return {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
      surface: privateStagingBinding.surface,
    };
  }
  return domainRepository.findVerifiedActiveByHostname(hostname);
}
