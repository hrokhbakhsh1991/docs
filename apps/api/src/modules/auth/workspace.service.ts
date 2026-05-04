import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { AuthWorkspaceItemDto } from "./dto/auth-workspace-item.dto";

/**
 * Workspace listing uses DB function `list_user_workspaces_for_auth(uuid)` (migration
 * 1777567000000), same SECURITY DEFINER + row_security=off pattern as
 * `resolve_tour_tenant_for_public_flow`: session-scoped SET LOCAL row_security is not used
 * here because app DB roles may not own tables in every deployment; the definer-owned
 * function is the minimal, auditable bypass already established for RLS-heavy reads.
 */
@Injectable()
export class WorkspaceService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly requestContextService: RequestContextService
  ) {}

  /** Lists workspace rows for the JWT subject via `list_user_workspaces_for_auth`. */
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

    return this.dataSource.query<AuthWorkspaceItemDto[]>(
      `SELECT tenant_id, tenant_name, role
       FROM list_user_workspaces_for_auth($1::uuid)`,
      [userId]
    );
  }
}

