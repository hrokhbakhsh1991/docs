import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditService } from "./audit.service";
import { WORKSPACE_AUDIT_REPOSITORY_PORT } from "./domain/ports/workspace-audit-repository.port";
import { TypeOrmWorkspaceAuditRepository } from "./repositories/typeorm-workspace-audit.repository";
import { WorkspaceAuditLogEntity } from "./entities/workspace-audit-log.entity";

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceAuditLogEntity])],
  providers: [
    TypeOrmWorkspaceAuditRepository,
    {
      provide: WORKSPACE_AUDIT_REPOSITORY_PORT,
      useExisting: TypeOrmWorkspaceAuditRepository,
    },
    AuditService,
  ],
  exports: [AuditService],
})
export class AuditModule {}
