import { Inject, Injectable } from "@nestjs/common";
import {
  WORKSPACE_AUDIT_REPOSITORY_PORT,
  type WorkspaceAuditRepositoryPort,
} from "./domain/ports/workspace-audit-repository.port";

@Injectable()
export class AuditService {
  constructor(
    @Inject(WORKSPACE_AUDIT_REPOSITORY_PORT)
    private readonly auditRepository: WorkspaceAuditRepositoryPort
  ) {}

  log(data: {
    workspaceId: string;
    userId: string;
    entityType: "tour" | "preset";
    entityId: string;
    action: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    return this.auditRepository.log(data);
  }
}
