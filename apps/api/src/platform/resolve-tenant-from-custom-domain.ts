import { PlatformDomainRepository } from "./platform-domain.repository.ts";
import { resolveSmokeCustomApexHost } from "./resolve-smoke-custom-apex-host.ts";

export async function resolveTenantFromCustomDomainHost(
  hostname: string,
  deps: { domainRepository?: PlatformDomainRepository } = {}
): Promise<{ tenantId: string; subdomain: string; surface: string } | null> {
  const smoke = resolveSmokeCustomApexHost(hostname);
  if (smoke !== null) {
    return smoke;
  }
  const repository = deps.domainRepository ?? new PlatformDomainRepository();
  return repository.findVerifiedActiveByHostname(hostname);
}
