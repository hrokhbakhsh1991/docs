import { PlatformDomainRepository } from "./platform-domain.repository.ts";

export async function resolveTenantFromCustomDomainHost(
  hostname: string,
  deps: { domainRepository?: PlatformDomainRepository } = {}
): Promise<{ tenantId: string; subdomain: string; surface: string } | null> {
  const repository = deps.domainRepository ?? new PlatformDomainRepository();
  return repository.findVerifiedActiveByHostname(hostname);
}
