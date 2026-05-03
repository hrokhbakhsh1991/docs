import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { EntityManager, FindOptionsWhere, Repository } from "typeorm";
import { IsNull } from "typeorm";
import { UserEntity } from "../../modules/identity/entities/user.entity";
import { PaymentEntity } from "../../modules/payments/entities/payment.entity";
import { RegistrationEntity } from "../../modules/registrations/registration.entity";
import { WaitlistItemEntity } from "../../modules/registrations/waitlist-item.entity";
import { RequestContextService } from "../request-context/request-context.service";

type ActorScope = {
  role: string;
  tenantId?: string;
  userId?: string;
};

type MemberIdentity = {
  syntheticPhone: string;
  telegramUserId?: string;
};

function roleTag(role?: string): string {
  return (role ?? "").trim().toLowerCase();
}

function isAdminRole(role?: string): boolean {
  return roleTag(role) === "admin";
}

function isLeaderRole(role?: string): boolean {
  const r = roleTag(role);
  return r === "owner" || r === "admin";
}

function isMemberRole(role?: string): boolean {
  const r = roleTag(role);
  return r === "member";
}

export function syntheticBookingContactPhone(userId: string): string {
  const hex = userId.replace(/-/g, "");
  const mod = BigInt(`0x${hex}`) % 10_000_000_000_000n;
  return `+${mod.toString().padStart(12, "0")}`;
}

function requireActorScope(ctx: RequestContextService): ActorScope {
  const role = roleTag(ctx.getRole());
  const userId = ctx.getUserId();
  const tenantId = ctx.getTenantId();
  if (!role) {
    throw new ForbiddenException({
      error: {
        code: "AUTH_FORBIDDEN_ROLE",
        message: "Insufficient role for this operation"
      }
    });
  }
  if (!userId) {
    throw new ForbiddenException({
      error: {
        code: "AUTH_UNAUTHENTICATED",
        message: "Authentication required"
      }
    });
  }
  if (!tenantId && !isAdminRole(role)) {
    throw new ForbiddenException({
      error: {
        code: "TENANT_CONTEXT_MISSING",
        message: "Trusted tenant context required but absent"
      }
    });
  }
  return { role, userId, tenantId };
}

async function resolveMemberIdentity(
  manager: EntityManager,
  actorUserId: string
): Promise<MemberIdentity> {
  const user = await manager.findOne(UserEntity, {
    where: { id: actorUserId, deletedAt: IsNull() }
  });
  if (!user) {
    throw new NotFoundException({
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "Resource not found in tenant scope"
      }
    });
  }
  const telegramUserId =
    typeof user.telegramUserId === "string" && user.telegramUserId.trim() !== ""
      ? user.telegramUserId.trim()
      : undefined;
  return {
    syntheticPhone: syntheticBookingContactPhone(actorUserId),
    telegramUserId
  };
}

export async function registrationWhereForActor(
  manager: EntityManager,
  _userRepo: Repository<UserEntity>,
  ctx: RequestContextService,
  registrationId: string
): Promise<FindOptionsWhere<RegistrationEntity> | FindOptionsWhere<RegistrationEntity>[]> {
  const actor = requireActorScope(ctx);
  if (isAdminRole(actor.role)) {
    return { id: registrationId, deletedAt: IsNull() };
  }
  if (isLeaderRole(actor.role)) {
    return {
      id: registrationId,
      tenantId: actor.tenantId!,
      deletedAt: IsNull()
    };
  }
  if (!isMemberRole(actor.role)) {
    throw new ForbiddenException({
      error: {
        code: "AUTH_FORBIDDEN_ROLE",
        message: "Insufficient role for this operation"
      }
    });
  }
  const identity = await resolveMemberIdentity(manager, actor.userId!);
  const memberClauses: FindOptionsWhere<RegistrationEntity>[] = [
    {
      id: registrationId,
      tenantId: actor.tenantId!,
      deletedAt: IsNull(),
      participantContactPhone: identity.syntheticPhone
    }
  ];
  if (identity.telegramUserId) {
    memberClauses.push({
      id: registrationId,
      tenantId: actor.tenantId!,
      deletedAt: IsNull(),
      telegramUserId: identity.telegramUserId
    });
  }
  return memberClauses;
}

export async function waitlistWhereForActor(
  manager: EntityManager,
  _userRepo: Repository<UserEntity>,
  ctx: RequestContextService,
  waitlistItemId: string
): Promise<FindOptionsWhere<WaitlistItemEntity>> {
  const actor = requireActorScope(ctx);
  if (isAdminRole(actor.role)) {
    return { id: waitlistItemId, deletedAt: IsNull() };
  }
  if (isLeaderRole(actor.role)) {
    return {
      id: waitlistItemId,
      tenantId: actor.tenantId!,
      deletedAt: IsNull()
    };
  }
  if (!isMemberRole(actor.role)) {
    throw new ForbiddenException({
      error: {
        code: "AUTH_FORBIDDEN_ROLE",
        message: "Insufficient role for this operation"
      }
    });
  }
  const identity = await resolveMemberIdentity(manager, actor.userId!);
  return {
    id: waitlistItemId,
    tenantId: actor.tenantId!,
    deletedAt: IsNull(),
    participantContactPhone: identity.syntheticPhone
  };
}

/**
 * Loads a Payment by ID with tenant + role-based scope.
 * Leaders (owner role) access any payment in JWT tenantId; members only if tied registration is theirs.
 */
export async function findPaymentScopedForActor(
  manager: EntityManager,
  userRepo: Repository<UserEntity>,
  ctx: RequestContextService,
  paymentId: string
): Promise<PaymentEntity> {
  const actor = requireActorScope(ctx);
  let payment: PaymentEntity | null;

  if (isAdminRole(actor.role)) {
    payment = await manager.findOne(PaymentEntity, {
      where: { id: paymentId, deletedAt: IsNull() }
    });
  } else {
    if (!actor.tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }
    payment = await manager.findOne(PaymentEntity, {
      where: {
        id: paymentId,
        tenantId: actor.tenantId,
        deletedAt: IsNull()
      }
    });
  }

  if (!payment) {
    throw new NotFoundException({
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "Resource not found in tenant scope"
      }
    });
  }

  if (isMemberRole(actor.role)) {
    const regWhere = await registrationWhereForActor(
      manager,
      userRepo,
      ctx,
      payment.registrationId
    );
    const registration = await manager.findOne(RegistrationEntity, {
      where: regWhere
    });
    if (!registration) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }
  }

  return payment;
}
