/** P2-D v1 — synchronous SSL on verify success. Cron deferred to manual run-ssl-expiry-check. */
import { appendPlatformAuditEventOutsideTx } from "./append-platform-audit-event-outside-tx.ts";
import {
  PLATFORM_AUDIT_ACTION_DOMAIN_SSL_FAILED,
  PLATFORM_AUDIT_ACTION_DOMAIN_SSL_PROVISIONED,
} from "./platform-audit-logger.ts";
import { toTenantDomainDto, type TenantDomainDto } from "./platform-domain.dto.ts";
import { PlatformDomainRepository } from "./platform-domain.repository.ts";
import { createPlatformSslProvider } from "./ssl/create-platform-ssl-provider.ts";

export async function provisionTenantDomainSsl(
  input: {
    domainId: string;
    hostname: string;
    surface: "marketing" | "portal";
    actorId: string;
  },
  deps: {
    domainRepository?: PlatformDomainRepository;
    appendAudit?: typeof appendPlatformAuditEventOutsideTx;
  } = {}
): Promise<TenantDomainDto> {
  const repository = deps.domainRepository ?? new PlatformDomainRepository();
  const appendAudit = deps.appendAudit ?? appendPlatformAuditEventOutsideTx;
  await repository.updateSslState(input.domainId, {
    sslStatus: "provisioning",
    sslLastError: null,
  });

  const result = await createPlatformSslProvider().provision({
    hostname: input.hostname,
    surface: input.surface,
  });

  if (result.ok) {
    await repository.updateSslState(input.domainId, {
      sslStatus: "active",
      sslExpiresAt: result.expiresAt,
    });
    await appendAudit({
      action: PLATFORM_AUDIT_ACTION_DOMAIN_SSL_PROVISIONED,
      entityType: "tenant_domain",
      entityId: input.domainId,
      actorId: input.actorId,
      metadata: { hostname: input.hostname },
    });
  } else {
    await repository.updateSslState(input.domainId, {
      sslStatus: "failed",
      sslLastError: result.errorMessage ?? "ssl_failed",
    });
    await appendAudit({
      action: PLATFORM_AUDIT_ACTION_DOMAIN_SSL_FAILED,
      entityType: "tenant_domain",
      entityId: input.domainId,
      actorId: input.actorId,
      metadata: { hostname: input.hostname, error: result.errorMessage ?? "ssl_failed" },
    });
  }

  const row = await repository.findById(input.domainId);
  if (!row) {
    throw new Error("DOMAIN_NOT_FOUND_AFTER_SSL");
  }
  return toTenantDomainDto(row);
}
