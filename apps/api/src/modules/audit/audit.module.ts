import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditService } from "./audit.service";
import { WorkspaceAuditLogEntity } from "./entities/workspace-audit-log.entity";

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceAuditLogEntity])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
