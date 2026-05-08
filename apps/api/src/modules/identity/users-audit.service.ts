import { Injectable, NotFoundException } from "@nestjs/common";
import { IsNull } from "typeorm";
import type { UserRoleHistoryItemDto } from "./dto/user-role-history-item.dto";
import { UserEntity } from "./entities/user.entity";
import { UserRoleAuditEntity } from "./entities/user-role-audit.entity";
import { tenantScopedResourceNotFoundError } from "../../common/errors/error-response-builders";
import { UsersAccessService } from "./users-access.service";

@Injectable()
export class UsersAuditService {
  constructor(private readonly access: UsersAccessService) {}

  async getUserRoleHistory(userId: string): Promise<UserRoleHistoryItemDto[]> {
    const tenantId = this.access.resolveTenantIdOrThrow();

    const membership = await this.access.memberships.findOne({
      where: { tenantId, userId, deletedAt: IsNull() }
    });
    if (!membership) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    const rows = await this.access.memberships.manager
      .getRepository(UserRoleAuditEntity)
      .createQueryBuilder("audit")
      .innerJoin(UserEntity, "actor", "actor.id = audit.actor_user_id AND actor.deleted_at IS NULL")
      .where("audit.tenant_id = :tenantId", { tenantId })
      .andWhere("audit.target_user_id = :userId", { userId })
      .select([
        "audit.actor_user_id AS actor_user_id",
        "actor.email AS actor_email",
        "audit.old_role AS old_role",
        "audit.new_role AS new_role",
        "audit.created_at AS created_at"
      ])
      .orderBy("audit.created_at", "DESC")
      .limit(50)
      .getRawMany<{
        actor_user_id: string;
        actor_email: string;
        old_role: string;
        new_role: string;
        created_at: Date;
      }>();

    return rows.map((row) => ({
      actorUserId: row.actor_user_id,
      actorEmail: row.actor_email,
      oldRole: row.old_role,
      newRole: row.new_role,
      createdAt: row.created_at.toISOString()
    }));
  }
}
