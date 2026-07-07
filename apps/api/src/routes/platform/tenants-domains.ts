import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsWriteRole } from "../../platform/assert-platform-ops-role.ts";
import { assertTenantPlatformFeature } from "../../platform/assert-tenant-platform-feature.ts";
import { parseCreateTenantDomainBody } from "../../platform/create-tenant-domain.schema.ts";
import {
  buildTenantDomainCnameTarget,
  toTenantDomainDto,
} from "../../platform/platform-domain.dto.ts";
import { PlatformDomainRepository } from "../../platform/platform-domain.repository.ts";
import { PlatformTenantRepository } from "../../platform/platform-tenant.repository.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
  PlatformValidation,
  PlatformFeatureForbidden,
} from "../../platform/platform.errors.ts";

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }
  return rawBody.length > 0 ? JSON.parse(rawBody) : {};
}

function writePlatformAuthError(res: ServerResponse, err: unknown): boolean {
  if (err instanceof PlatformUnauthorized || (err as { code?: string })?.code === "PLATFORM_UNAUTHORIZED") {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized", code: "PLATFORM_UNAUTHORIZED" }));
    return true;
  }
  if (err instanceof PlatformForbidden || (err as { code?: string })?.code === "PLATFORM_FORBIDDEN") {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
    return true;
  }
  return false;
}

export async function handlePlatformTenantsDomains(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string,
  deps: {
    tenantRepository?: PlatformTenantRepository;
    domainRepository?: PlatformDomainRepository;
  } = {}
): Promise<void> {
  try {
    await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
  } catch (err: unknown) {
    if (writePlatformAuthError(res, err)) return;
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
    return;
  }

  const tenantRepository = deps.tenantRepository ?? new PlatformTenantRepository();
  const domainRepository = deps.domainRepository ?? new PlatformDomainRepository();
  const tenant = await tenantRepository.getById(tenantId);
  if (!tenant) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }

  if (req.method === "GET") {
    const items = await domainRepository.listByTenantId(tenantId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ items: items.map(toTenantDomainDto) }));
    return;
  }

  if (req.method === "POST") {
    let ctx;
    try {
      ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
      assertPlatformOpsWriteRole(ctx);
    } catch (err: unknown) {
      if (writePlatformAuthError(res, err)) return;
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
      return;
    }

    try {
      try {
        await assertTenantPlatformFeature(tenantId, "custom_domain");
      } catch (err: unknown) {
        if (
          err instanceof PlatformFeatureForbidden ||
          (err as { code?: string })?.code === "PLATFORM_FEATURE_FORBIDDEN"
        ) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FEATURE_FORBIDDEN" }));
          return;
        }
        throw err;
      }

      const body = parseCreateTenantDomainBody(await readJsonBody(req));
      const surface = body.surface ?? "marketing";
      const cnameTarget = buildTenantDomainCnameTarget(tenant.subdomain, surface);
      const domain = await domainRepository.create({
        tenantId,
        hostname: body.hostname,
        surface,
        cnameTarget,
      });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          domain: toTenantDomainDto(domain),
          cnameInstructions: {
            hostname: domain.hostname,
            cnameTarget: domain.cnameTarget,
          },
        })
      );
    } catch (err: unknown) {
      if (err instanceof PlatformValidation || (err as { code?: string })?.code === "PLATFORM_VALIDATION") {
        res.writeHead(422, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "validation_failed", code: "PLATFORM_VALIDATION" }));
        return;
      }
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
    return;
  }

  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "method_not_allowed" }));
}

export async function handlePlatformTenantDomainById(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string,
  domainId: string,
  deps: { domainRepository?: PlatformDomainRepository } = {}
): Promise<void> {
  let ctx;
  try {
    ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
    assertPlatformOpsWriteRole(ctx);
  } catch (err: unknown) {
    if (writePlatformAuthError(res, err)) return;
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
    return;
  }

  const domainRepository = deps.domainRepository ?? new PlatformDomainRepository();

  if (req.method === "DELETE") {
    const deleted = await domainRepository.deleteByIdForTenant(tenantId, domainId);
    if (!deleted) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
      return;
    }
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "method_not_allowed" }));
}

export async function handlePlatformTenantDomainVerify(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string,
  domainId: string,
  deps: { domainRepository?: PlatformDomainRepository } = {}
): Promise<void> {
  let ctx;
  try {
    ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
    assertPlatformOpsWriteRole(ctx);
  } catch (err: unknown) {
    if (writePlatformAuthError(res, err)) return;
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
    return;
  }

  const domainRepository = deps.domainRepository ?? new PlatformDomainRepository();
  const domain = await domainRepository.findByIdForTenant(tenantId, domainId);
  if (!domain) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }

  const { verifyTenantDomainCnameLive } = await import("../../platform/verify-tenant-domain.ts");
  const verification = await verifyTenantDomainCnameLive({
    hostname: domain.hostname,
    cnameTarget: domain.cnameTarget,
  });
  if (!verification.ok) {
    res.writeHead(422, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, message: verification.message }));
    return;
  }

  const observed = verification.observedCname ?? null;
  const verified = await domainRepository.markVerified(domainId, observed);
  if (!verified) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }

  const { appendPlatformAuditEventOutsideTx } = await import(
    "../../platform/append-platform-audit-event-outside-tx.ts"
  );
  const { PLATFORM_AUDIT_ACTION_DOMAIN_VERIFIED } = await import(
    "../../platform/platform-audit-logger.ts"
  );
  await appendPlatformAuditEventOutsideTx({
    action: PLATFORM_AUDIT_ACTION_DOMAIN_VERIFIED,
    entityType: "tenant_domain",
    entityId: domainId,
    actorId: ctx.actorId,
    metadata: { hostname: domain.hostname, tenantId },
  });

  const { provisionTenantDomainSsl } = await import("../../platform/provision-tenant-domain-ssl.ts");
  const surface = domain.surface === "portal" ? "portal" : "marketing";
  const withSsl = await provisionTenantDomainSsl({
    domainId,
    hostname: domain.hostname,
    surface,
    actorId: ctx.actorId,
  });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, domain: withSsl }));
}
