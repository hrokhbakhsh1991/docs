import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { WorkspaceAuditRepositoryPort } from "../domain/ports/workspace-audit-repository.port";
import { WorkspaceAuditLogEntity } from "../entities/workspace-audit-log.entity";

@Injectable()
export class TypeOrmWorkspaceAuditRepository implements WorkspaceAuditRepositoryPort {
  constructor(
    @InjectRepository(WorkspaceAuditLogEntity)
    private readonly auditRepository: Repository<WorkspaceAuditLogEntity>
  ) {}

  async log(data: {
    workspaceId: string;
    userId: string;
    entityType: "tour" | "preset";
    entityId: string;
    action: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    const log = this.auditRepository.create({
      workspaceId: data.workspaceId,
      userId: data.userId,
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      meta: data.meta ?? {},
    });
    await this.auditRepository.save(log);
  }
}
