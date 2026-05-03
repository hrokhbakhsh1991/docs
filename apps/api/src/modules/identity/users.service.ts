import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { UserTenantEntity } from "./entities/user-tenant.entity";
import { UserEntity } from "./entities/user.entity";
import type { UserResponseDto } from "./dto/user-response.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserTenantEntity)
    private readonly userTenantRepository: Repository<UserTenantEntity>,
    private readonly requestContextService: RequestContextService
  ) {}

  async listUsers(): Promise<UserResponseDto[]> {
    const tenantId = this.requestContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    const memberships = await this.userTenantRepository.find({
      where: { tenantId, deletedAt: IsNull() },
      order: { createdAt: "DESC" }
    });
    if (memberships.length === 0) return [];
    const rows = await this.userRepository
      .createQueryBuilder("u")
      .innerJoin(
        UserTenantEntity,
        "ut",
        "ut.user_id = u.id AND ut.tenant_id = :tenantId AND ut.deleted_at IS NULL",
        { tenantId }
      )
      .where("u.deleted_at IS NULL")
      .select([
        "u.id AS id",
        "u.full_name AS full_name",
        "u.email AS email",
        "u.is_email_verified AS is_email_verified",
        "ut.role AS role"
      ])
      .orderBy("ut.created_at", "DESC")
      .getRawMany<{
        id: string;
        full_name: string | null;
        email: string;
        is_email_verified: boolean;
        role: string;
      }>();
    return rows.map((row) => ({
      id: row.id,
      name: row.full_name?.trim() || row.email.split("@")[0] || "User",
      email: row.email,
      role: row.role,
      status: row.is_email_verified ? "Active" : "Invited"
    }));
  }

  async updateUserRole(userId: string, role: string): Promise<UserResponseDto> {
    const tenantId = this.requestContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    const membership = await this.userTenantRepository.findOne({
      where: { tenantId, userId, deletedAt: IsNull() }
    });
    if (!membership) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }

    membership.role = role;
    await this.userTenantRepository.save(membership);

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }

    return {
      id: user.id,
      name: user.fullName?.trim() || user.email.split("@")[0] || "User",
      email: user.email,
      role: membership.role,
      status: user.isEmailVerified ? "Active" : "Invited"
    };
  }
}
