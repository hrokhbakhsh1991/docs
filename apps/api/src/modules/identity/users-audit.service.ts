import { Injectable, NotFoundException } from "@nestjs/common";
import type { UserRoleHistoryItemDto } from "./dto/user-role-history-item.dto";
import { tenantScopedResourceNotFoundError } from "../../common/errors/error-response-builders";
import { UsersAccessService } from "./users-access.service";

@Injectable()
export class UsersAuditService {
  constructor(private readonly access: UsersAccessService) {}

  async getUserRoleHistory(userId: string): Promise<UserRoleHistoryItemDto[]> {
    const tenantId = this.access.resolveTenantIdOrThrow();

    const membership = await this.access.findMembership(tenantId, userId);
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    const rows = await this.access.listUserRoleHistoryRows(tenantId, userId);

    return rows.map((row) => ({
      actorUserId: row.actor_user_id,
      actorEmail: row.actor_email,
      oldRole: row.old_role,
      newRole: row.new_role,
      createdAt: row.created_at.toISOString()
    }));
  }
}
