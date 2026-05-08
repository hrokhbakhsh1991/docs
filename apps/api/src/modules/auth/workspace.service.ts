import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { UserTenantEntity } from "../identity/entities/user-tenant.entity";
import { TenantManagementDbService } from "../tenant/tenant-management-db.service";
import { Role } from "./roles.enum";
import type { AuthWorkspaceItemDto } from "./dto/auth-workspace-item.dto";
import type { CreateWorkspaceDto } from "./dto/create-workspace.dto";

/** Workspace listing reads cross-tenant memberships via TenantManagementDbService. */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(TenantManagementDbService)
    private readonly tenantManagementDbService: TenantManagementDbService
  ) {}

  /** Lists workspace rows for the JWT subject. */
  async listWorkspaces(): Promise<AuthWorkspaceItemDto[]> {
    const userId = this.requestContextService.getUserId();
    if (!userId) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_UNAUTHENTICATED",
          message: "Authentication required"
        }
      });
    }

    return this.tenantManagementDbService.listUserWorkspacesForAuth(userId);
  }

  /** Creates a new workspace and attaches current user as owner. */
  async createWorkspace(input: CreateWorkspaceDto): Promise<AuthWorkspaceItemDto> {
    const userId = this.requestContextService.getUserId();
    if (!userId) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_UNAUTHENTICATED",
          message: "Authentication required"
        }
      });
    }

    const tenantName = input.name.trim();
    const tenantSubdomain = input.subdomain.trim().toLowerCase();
    try {
      return await this.dataSource.transaction(async (manager) => {
        const tenant = await manager.save(
          TenantEntity,
          manager.create(TenantEntity, {
            name: tenantName,
            subdomain: tenantSubdomain
          })
        );
        await manager.save(
          UserTenantEntity,
          manager.create(UserTenantEntity, {
            tenantId: tenant.id,
            userId,
            role: Role.OWNER
          })
        );
        return {
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          tenant_subdomain: tenant.subdomain ?? "",
          role: Role.OWNER,
          session_version: 1
        };
      });
    } catch (error) {
      if (this.isSubdomainUniqueViolation(error)) {
        throw new ConflictException({
          error: {
            code: "WORKSPACE_SUBDOMAIN_TAKEN",
            message: "Workspace subdomain is already in use"
          }
        });
      }
      throw error;
    }
  }

  private isSubdomainUniqueViolation(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const anyError = error as Error & { code?: string; detail?: string; constraint?: string };
    return (
      anyError.code === "23505" &&
      ((typeof anyError.constraint === "string" &&
        anyError.constraint.includes("uq_tenants_subdomain_active_lower")) ||
        (typeof anyError.detail === "string" &&
          anyError.detail.toLowerCase().includes("uq_tenants_subdomain_active_lower")))
    );
  }
}

