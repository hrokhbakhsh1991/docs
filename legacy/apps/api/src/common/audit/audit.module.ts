import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TENANT_AUDIT_EVENTS_PORT } from "../contracts/workspace-invites.contract";
import { AuditLogService } from "./audit-log.service";
import { AuditService } from "./audit.service";
import { FinancialMutationAuditService } from "./financial-mutation-audit.service";
import { TenantAuditEventEntity } from "./entities/tenant-audit-event.entity";
import { TenantAuditEventsService } from "./tenant-audit-events.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TenantAuditEventEntity])],
  providers: [
    AuditService,
    AuditLogService,
    TenantAuditEventsService,
    FinancialMutationAuditService,
    {
      provide: TENANT_AUDIT_EVENTS_PORT,
      useExisting: TenantAuditEventsService
    }
  ],
  exports: [
    AuditService,
    AuditLogService,
    TenantAuditEventsService,
    FinancialMutationAuditService,
    TENANT_AUDIT_EVENTS_PORT,
    TypeOrmModule
  ]
})
export class AuditModule {}
