import { Inject, Injectable } from "@nestjs/common";

import { AUDIT_CATEGORY } from "./audit-category";
import { AuditService } from "./audit.service";
import type { AuditCategory } from "./audit-category";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";

export type AuditLogEventInput = {
  action: string;
  entity: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  category?: AuditCategory;
};

/**
 * Structured audit facade (Phase 13) — persists via {@link AuditService} + operational log line.
 */
@Injectable()
export class AuditLogService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(LoggerService) private readonly logger: LoggerService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async logEvent(input: AuditLogEventInput): Promise<void> {
    const tenantId = this.requestContext.tryGetTenantId();
    const actorId = this.requestContext.tryGetUserId();

    this.logger.info("AUDIT_EVENT", {
      actor_id: actorId,
      tenant_id: tenantId,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId,
      before: input.before,
      after: input.after,
      timestamp: new Date().toISOString(),
    });

    const actorDisplay =
      this.requestContext.tryGetUserId() ?? "system";

    await this.audit.recordAuditEvent({
      category: input.category ?? AUDIT_CATEGORY.SECURITY,
      action: input.action,
      actorDisplay,
      actorUserId: actorId,
      resource: { type: input.entity, id: input.entityId ?? null },
      metadata: {
        before: input.before,
        after: input.after,
      },
    });
  }
}
