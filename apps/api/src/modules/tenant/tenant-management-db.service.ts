import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, QueryRunner } from "typeorm";
import { LoggerService } from "../../common/logger/logger.service";
import { RequestContextService } from "../../common/request-context/request-context.service";

type AcceptInviteResult =
  | {
      ok: true;
      out_tenant_id: string;
      out_role: string;
      error_code: null;
    }
  | {
      ok: false;
      out_tenant_id: null;
      out_role: null;
      error_code:
        | "INVITE_NOT_FOUND"
        | "INVITE_EXPIRED"
        | "INVITE_ALREADY_ACCEPTED"
        | "INVITE_EMAIL_MISMATCH"
        | "OWNER_ROLE_INVITE_FORBIDDEN";
    };

@Injectable()
export class TenantManagementDbService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService) private readonly loggerService: LoggerService
  ) {}

  async listUserWorkspacesForAuth(userId: string): Promise<
    Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_subdomain: string;
      role: string;
      session_version: number;
    }>
  > {
    return this.runWithRowSecurityBypass(
      "list_user_workspaces_for_auth",
      async (queryRunner) =>
        queryRunner.query(
          `SELECT ut.tenant_id::text AS tenant_id,
                  t.name::text AS tenant_name,
                  COALESCE(NULLIF(trim(t.subdomain), ''), '')::text AS tenant_subdomain,
                  ut.role::text AS role,
                  ut.session_version::integer AS session_version
             FROM user_tenants ut
             INNER JOIN tenants t ON t.id = ut.tenant_id AND t.deleted_at IS NULL
            WHERE ut.user_id = $1::uuid
              AND ut.deleted_at IS NULL`,
          [userId]
        )
    );
  }

  async acceptWorkspaceInviteByToken(
    inviteToken: string,
    userId: string
  ): Promise<AcceptInviteResult> {
    return this.runWithRowSecurityBypass(
      "accept_workspace_invite",
      async (queryRunner) => this.acceptInviteInTransaction(queryRunner, inviteToken, userId)
    );
  }

  private async runWithRowSecurityBypass<T>(
    operation: string,
    fn: (queryRunner: QueryRunner) => Promise<T>
  ): Promise<T> {
    const requestId = this.requestContextService.tryGetRequestId();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Local transaction-only bypass for legacy bootstrap/auth flows.
      await queryRunner.query("SET LOCAL row_security = off");
      this.loggerService.warn("tenant management row_security bypass opened", {
        operation,
        requestId
      });
      const result = await fn(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.loggerService.error("tenant management row_security bypass failed", {
        operation,
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async acceptInviteInTransaction(
    queryRunner: QueryRunner,
    inviteToken: string,
    userId: string
  ): Promise<AcceptInviteResult> {
    // Contract: TS validates, DB mutates atomically.
    const result = await queryRunner.query(
      `SELECT id, tenant_id, role, email, expires_at, status
         FROM workspace_invites
        WHERE invite_token = $1
        FOR UPDATE`,
      [inviteToken]
    );
    const rows = result as Array<{
      id: string;
      tenant_id: string;
      role: string;
      email: string;
      expires_at: Date;
      status: "PENDING" | "ACCEPTED" | "EXPIRED";
    }>;
    const invite = rows[0];
    if (!invite) {
      return {
        ok: false,
        out_tenant_id: null,
        out_role: null,
        error_code: "INVITE_NOT_FOUND"
      };
    }

    if (invite.status === "ACCEPTED") {
      return {
        ok: false,
        out_tenant_id: null,
        out_role: null,
        error_code: "INVITE_ALREADY_ACCEPTED"
      };
    }

    if (invite.status === "EXPIRED" || new Date(invite.expires_at).getTime() < Date.now()) {
      await queryRunner.query(
        `UPDATE workspace_invites
            SET status = 'EXPIRED'
          WHERE id = $1::uuid`,
        [invite.id]
      );
      return {
        ok: false,
        out_tenant_id: null,
        out_role: null,
        error_code: "INVITE_EXPIRED"
      };
    }

    await queryRunner.query(
      `INSERT INTO user_tenants (
         id,
         tenant_id,
         created_at,
         updated_at,
         deleted_at,
         user_id,
         role,
         session_version
       )
       VALUES (uuid_generate_v4(), $1::uuid, now(), now(), NULL, $2::uuid, $3::varchar, 1)
       ON CONFLICT (user_id, tenant_id)
       DO UPDATE SET
         deleted_at = NULL,
         role = EXCLUDED.role,
         updated_at = now(),
         session_version = user_tenants.session_version + 1`,
      [invite.tenant_id, userId, invite.role]
    );

    await queryRunner.query(
      `UPDATE workspace_invites
          SET status = 'ACCEPTED'
        WHERE id = $1::uuid`,
      [invite.id]
    );

    return {
      ok: true,
      out_tenant_id: invite.tenant_id,
      out_role: invite.role,
      error_code: null
    };
  }
}
