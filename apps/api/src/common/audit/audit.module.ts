import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TENANT_AUDIT_EVENTS_PORT } from "../contracts/workspace-invites.contract";
import { AuditService } from "./audit.service";
import { TenantAuditEventEntity } from "./entities/tenant-audit-event.entity";
import { TenantAuditEventsService } from "./tenant-audit-events.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TenantAuditEventEntity])],
  providers: [
    AuditService,
    TenantAuditEventsService,
    {
      provide: TENANT_AUDIT_EVENTS_PORT,
      useExisting: TenantAuditEventsService
    }
  ],
  exports: [AuditService, TenantAuditEventsService, TENANT_AUDIT_EVENTS_PORT, TypeOrmModule]
})
export class AuditModule {}
