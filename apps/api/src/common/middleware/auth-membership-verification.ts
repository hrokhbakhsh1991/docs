import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { QueryRunner } from "typeorm";
import { decodeJwtCapabilitySnapshot } from "@repo/shared";

import { logJwtCapabilitySnapshotDriftIfNeeded } from "../auth/log-jwt-capability-snapshot-drift";
import { resolveEffectiveCapabilitiesFromHydrationRow } from "../auth/membership-capability-snapshot";
import type { UserRole } from "../auth/user-role.enum";
import { tryParseWorkspaceUserRole } from "../auth/user-role.enum";
import type { LoggerService } from "../logger/logger.service";
import type { RequestContextService } from "../request-context/request-context.service";
import { TenantEntity } from "../../modules/identity/entities/tenant.entity";
import { UserTenantEntity } from "../../modules/identity/entities/user-tenant.entity";
import type { MembershipAbilityHydrationRow } from "./hydrate-workspace-ability-context";
import { hydrateWorkspaceAbilityContext } from "./hydrate-workspace-ability-context";

export type ActiveMembershipHydrationRow = MembershipAbilityHydrationRow & {
  session_version: string | number;
  role: string;
};

export async function fetchActiveMembershipHydrationRow(
  queryRunner: QueryRunner,
  userId: string,
  tenantId: string
): Promise<ActiveMembershipHydrationRow | null> {
  return queryRunner.manager
    .getRepository(UserTenantEntity)
    .createQueryBuilder("ut")
    .innerJoin(TenantEntity, "tenant", "tenant.id = ut.tenant_id")
    .select("ut.session_version", "session_version")
    .addSelect("ut.role", "role")
    .addSelect("ut.labels", "labels")
    .addSelect("ut.membership_metadata", "membership_metadata")
    .addSelect("tenant.enabled_modules", "enabled_modules")
    .where("ut.user_id = :userId", { userId })
    .andWhere("ut.tenant_id = :tenantId", { tenantId })
    .andWhere("ut.deleted_at IS NULL")
    .andWhere("ut.membership_status = 'ACTIVE'")
    .getRawOne<ActiveMembershipHydrationRow>()
    .then((row) => row ?? null);
}

export type VerifyMembershipInput = {
  userId: string;
  tenantId: string;
  jwtRole: UserRole;
  jwtSessionVersion: number;
  jwtCapsClaim?: string;
  queryRunner: QueryRunner;
  requestContextService: RequestContextService;
  loggerService: LoggerService;
  /** When true, missing membership / stale session / stale role fail silently (public optional JWT attach). */
  silentOnFailure?: boolean;
};

export type VerifyMembershipResult =
  | { ok: true; dbRole: UserRole; membershipRow: ActiveMembershipHydrationRow }
  | { ok: false; silent: true }
  | { ok: false; silent: false; error: unknown };

/**
 * Validates ACTIVE membership, session version, and JWT role against DB before ALS population.
 * On success, sets user/tenant/role (DB-authoritative) and hydrates CASL context.
 */
export async function verifyActiveMembershipAndHydrateContext(
  input: VerifyMembershipInput
): Promise<VerifyMembershipResult> {
  const {
    userId,
    tenantId,
    jwtRole,
    jwtSessionVersion,
    jwtCapsClaim,
    queryRunner,
    requestContextService,
    loggerService,
    silentOnFailure = false
  } = input;

  const membershipRow = await fetchActiveMembershipHydrationRow(queryRunner, userId, tenantId);

  if (!membershipRow) {
    if (silentOnFailure) {
      return { ok: false, silent: true };
    }
    loggerService.warn("User attempted access without tenant membership", { userId, tenantId });
    return {
      ok: false,
      silent: false,
      error: new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Access to tenant denied"
        }
      })
    };
  }

  const dbSessionVersion = Number(membershipRow.session_version);
  if (!Number.isInteger(dbSessionVersion) || dbSessionVersion !== jwtSessionVersion) {
    if (silentOnFailure) {
      return { ok: false, silent: true };
    }
    loggerService.warn("JWT session version stale or mismatched", {
      userId,
      tenantId,
      jwtSessionVersion,
      dbSessionVersion
    });
    return {
      ok: false,
      silent: false,
      error: new UnauthorizedException({
        error: {
          code: "AUTH_TOKEN_REVOKED",
          message: "Session is no longer valid; please sign in again"
        }
      })
    };
  }

  const dbRole = tryParseWorkspaceUserRole(String(membershipRow.role).trim());
  if (!dbRole) {
    if (silentOnFailure) {
      return { ok: false, silent: true };
    }
    loggerService.warn("Stored membership role is not a known workspace role", {
      userId,
      tenantId,
      storedRole: membershipRow.role
    });
    return {
      ok: false,
      silent: false,
      error: new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Access to tenant denied"
        }
      })
    };
  }

  if (dbRole !== jwtRole) {
    if (silentOnFailure) {
      return { ok: false, silent: true };
    }
    loggerService.warn("JWT role does not match active membership role", {
      userId,
      tenantId,
      jwtRole,
      dbRole
    });
    return {
      ok: false,
      silent: false,
      error: new UnauthorizedException({
        error: {
          code: "AUTH_TOKEN_STALE",
          message: "Session role is stale; please sign in again"
        }
      })
    };
  }

  requestContextService.setUserId(userId);
  requestContextService.setTenantId(tenantId);
  requestContextService.setRole(dbRole);

  const jwtCaps = decodeJwtCapabilitySnapshot(jwtCapsClaim);
  if (jwtCaps.length > 0) {
    requestContextService.setJwtCapabilitySnapshot(jwtCaps);
  }
  hydrateWorkspaceAbilityContext(requestContextService, membershipRow);
  logJwtCapabilitySnapshotDriftIfNeeded(loggerService, {
    userId,
    tenantId,
    jwtCapsClaim,
    effectiveFromDb: resolveEffectiveCapabilitiesFromHydrationRow(dbRole, membershipRow)
  });

  return { ok: true, dbRole, membershipRow };
}
