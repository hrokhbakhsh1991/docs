import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { DataSource, EntityManager, IsNull, MoreThan, QueryFailedError, type Repository } from "typeorm";

import { TenantAuditAction } from "../../common/audit/tenant-audit-actions";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { normalizeOtpPhoneInput } from "../../common/phone/otp-phone-normalize";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { OtpService } from "../auth/otp.service";
import { getIdempotentEntityManager } from "../idempotency/idempotent-transaction.context";
import { OutboxService } from "../outbox/outbox.service";
import type { PatchMeDto } from "./dto/patch-me.dto";
import { EmailVerificationTokenEntity } from "./entities/email-verification-token.entity";
import { UserEntity } from "./entities/user.entity";
import { UsersAccessService } from "./users-access.service";
import {
  OUTBOX_AGGREGATE_TYPE_EMAIL_VERIFICATION_TOKEN,
  OUTBOX_EVENT_TYPE_IDENTITY_EMAIL_VERIFICATION_SEND
} from "../outbox/identity-email-outbox.constants";
import { isBirthDateYmdEligible } from "./utils/gregorian-ymd-eligibility";
import { validateIranNationalIdChecksum } from "./utils/iran-national-id";
import {
  diffSelfPiiFieldKeys,
  mapUserEntityToMeProfileResponse,
  snapshotSelfPiiFromUser,
  type MeProfileVisibility
} from "./me-profile.mapper";
import type {
  EmailVerifiedResponse,
  MeProfileResponse,
  MobileChangedResponse,
  PendingEmailVerificationResponse
} from "./me-profile.types";

export type {
  EmailVerifiedResponse,
  MeProfileResponse,
  MobileChangedResponse,
  PendingEmailVerificationResponse
} from "./me-profile.types";

@Injectable()
export class MeService {
  private static readonly EMAIL_TOKEN_TTL_MS = 30 * 60 * 1000;

  constructor(
    userRepository: Repository<UserEntity>,
    dataSource: DataSource,
    usersAccess: UsersAccessService,
    requestContext: RequestContextService,
    outboxService: OutboxService,
    otpService: OtpService,
    tenantAuditEventsService: TenantAuditEventsService
  ) {
    this.userRepository = userRepository;
    this.dataSource = dataSource;
    this.usersAccess = usersAccess;
    this.requestContext = requestContext;
    this.outboxService = outboxService;
    this.otpService = otpService;
    this.tenantAuditEventsService = tenantAuditEventsService;
  }

  private readonly userRepository: Repository<UserEntity>;
  private readonly dataSource: DataSource;
  private readonly usersAccess: UsersAccessService;
  private readonly requestContext: RequestContextService;
  private readonly outboxService: OutboxService;
  private readonly otpService: OtpService;
  private readonly tenantAuditEventsService: TenantAuditEventsService;

  private emailPublicSuffix(email: string): string | null {
    const t = email.trim().toLowerCase();
    const at = t.lastIndexOf("@");
    if (at < 1 || at === t.length - 1) {
      return null;
    }
    return t.slice(at + 1);
  }

  private selfActorLabel(user: Pick<UserEntity, "email">, userId: string): string {
    const e = user.email?.trim();
    return e !== undefined && e !== "" ? e : userId;
  }

  /** Case-insensitive match on trimmed email (aligned with typical inbox uniqueness). */
  private async findActiveUserByEmailCaseInsensitive(
    repo: Repository<UserEntity>,
    email: string
  ): Promise<UserEntity | null> {
    const trimmed = email.trim();
    if (trimmed === "") {
      return null;
    }
    // tenant-isolation:qb-exempt — global email lookup; tenant membership enforced separately.
    return repo
      .createQueryBuilder("u")
      .where("LOWER(TRIM(u.email)) = LOWER(TRIM(:email))", { email: trimmed })
      .andWhere("u.deleted_at IS NULL")
      .getOne();
  }

  private tryGetActorRole(): string | undefined {
    try {
      const r = this.requestContext.getRole()?.trim();
      return r !== undefined && r !== "" ? r : undefined;
    } catch {
      return undefined;
    }
  }

  private selfProfileVisibility(userId: string): MeProfileVisibility {
    return {
      viewerUserId: userId,
      subjectUserId: userId,
      viewerRole: this.tryGetActorRole()
    };
  }

  private workspaceRoleAuditFields(): Record<string, unknown> {
    const role = this.tryGetActorRole();
    return role !== undefined ? { workspace_role: role } : {};
  }

  private isUsersNationalIdUniqueViolation(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) {
      return false;
    }
    const d = err.driverError as { code?: string; constraint?: string } | undefined;
    if (d?.code !== "23505") {
      return false;
    }
    return (
      d?.constraint === "uq_users_national_id_active" ||
      (typeof err.message === "string" && err.message.includes("uq_users_national_id_active"))
    );
  }

  private isOptimisticProfileVersionConflict(err: unknown): boolean {
    return (
      typeof err === "object" &&
      err !== null &&
      (err as { name?: unknown }).name === "OptimisticLockVersionMismatchError"
    );
  }

  private async persistUserProfileOrNationalIdConflict(
    repo: Repository<UserEntity>,
    user: UserEntity
  ): Promise<void> {
    try {
      await repo.save(user);
    } catch (err: unknown) {
      if (this.isOptimisticProfileVersionConflict(err)) {
        throw new ConflictException({
          error: {
            code: "PROFILE_ROW_VERSION_CONFLICT",
            message: "Profile changed concurrently — reload settings, then try again."
          }
        });
      }
      if (this.isUsersNationalIdUniqueViolation(err)) {
        throw new ConflictException({
          error: {
            code: "USER_NATIONAL_ID_CONFLICT",
            message: "National ID is already in use"
          }
        });
      }
      throw err;
    }
  }

  /** Profile writes join the Postgres transaction started by optional `Idempotency-Key`. */
  private async withProfileMutationTransaction<T>(
    run: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    const em = getIdempotentEntityManager();
    if (em) {
      return run(em);
    }
    return this.dataSource.transaction(run);
  }

  private assertExpectedProfileRowVersion(
    expected: number | undefined,
    entity: Pick<UserEntity, "profileRowVersion">
  ): void {
    if (expected === undefined) {
      return;
    }
    const cur = Number(entity.profileRowVersion);
    const want = Number(expected);
    if (want !== cur) {
      throw new ConflictException({
        error: {
          code: "PROFILE_ROW_VERSION_CONFLICT",
          message: "Profile changed in another tab or session — reload settings, then try again."
        }
      });
    }
  }

  private async applyNationalIdPatchOrThrow(
    repo: Repository<UserEntity>,
    user: UserEntity,
    value: string | null
  ): Promise<void> {
    if (value === null) {
      user.nationalId = null;
      return;
    }
    if (!validateIranNationalIdChecksum(value)) {
      throw new BadRequestException({
        error: {
          code: "USER_NATIONAL_ID_INVALID",
          message: "National ID is not valid"
        }
      });
    }
    const taken = await repo.findOne({
      where: { nationalId: value, deletedAt: IsNull() }
    });
    if (taken && taken.id !== user.id) {
      throw new ConflictException({
        error: {
          code: "USER_NATIONAL_ID_CONFLICT",
          message: "National ID is already in use"
        }
      });
    }
    user.nationalId = value;
  }

  private applyBirthDatePatchOrThrow(user: UserEntity, value: string | null): void {
    if (value === null) {
      user.birthDate = null;
      return;
    }
    if (!isBirthDateYmdEligible(value)) {
      throw new BadRequestException({
        error: {
          code: "USER_BIRTH_DATE_INVALID",
          message: "Birth date is not valid"
        }
      });
    }
    user.birthDate = value;
  }

  private async applyMePatchDtoToUser(
    repo: Repository<UserEntity>,
    user: UserEntity,
    dto: PatchMeDto
  ): Promise<void> {
    if (dto.full_name !== undefined) {
      user.fullName = dto.full_name === null ? null : dto.full_name;
    }

    if (dto.notifications_enabled !== undefined) {
      user.notificationsEnabled = dto.notifications_enabled;
    }

    if (dto.national_id !== undefined) {
      await this.applyNationalIdPatchOrThrow(repo, user, dto.national_id);
    }
    if (dto.gender !== undefined) {
      user.gender = dto.gender;
    }
    if (dto.birth_date !== undefined) {
      this.applyBirthDatePatchOrThrow(user, dto.birth_date);
    }
  }

  private resolveSelfOrThrow(): { tenantId: string; userId: string } {
    const tenantId = this.requestContext.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    const userId = this.requestContext.getUserId();
    if (!userId) {
      throw new ForbiddenException(authRequiredError());
    }
    return { tenantId, userId };
  }

  async getMe(): Promise<MeProfileResponse> {
    const { tenantId, userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(tenantId, userId);

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new NotFoundException({
        error: { code: "USER_NOT_FOUND", message: "User not found" }
      });
    }

    return mapUserEntityToMeProfileResponse(user, this.selfProfileVisibility(userId));
  }

  async patchMe(
    dto: PatchMeDto,
    concurrency?: { expectedProfileRowVersion?: number }
  ): Promise<MeProfileResponse | PendingEmailVerificationResponse> {
    const { tenantId, userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(tenantId, userId);

    return this.withProfileMutationTransaction(async (manager) => {
      const repo = manager.getRepository(UserEntity);
      const user = await repo.findOne({
        where: { id: userId, deletedAt: IsNull() }
      });
      if (!user) {
        throw new NotFoundException({
          error: { code: "USER_NOT_FOUND", message: "User not found" }
        });
      }

      this.assertExpectedProfileRowVersion(concurrency?.expectedProfileRowVersion, user);

      const wantsEmailVerificationFlow =
        dto.email !== undefined &&
        dto.email.trim().toLowerCase() !== user.email.trim().toLowerCase();

      if (wantsEmailVerificationFlow) {
        const next = dto.email!.trim();
        const u = user;
        const priorEmail = u.email.trim();
        await this.applyMePatchDtoToUser(repo, u, dto);

        const ownerOfEmail = await repo.findOne({
          where: { email: next, deletedAt: IsNull() }
        });
        if (ownerOfEmail && ownerOfEmail.id !== u.id) {
          throw new ConflictException({
            error: {
              code: "USER_EMAIL_CONFLICT",
              message: "Email is already in use"
            }
          });
        }

        await this.persistUserProfileOrNationalIdConflict(repo, u);

        // tenant-isolation:qb-exempt — tokens keyed by authenticated user_id within tenant-scoped transaction.
        await manager
          .createQueryBuilder()
          .delete()
          .from(EmailVerificationTokenEntity)
          .where("user_id = :userId AND used_at IS NULL", { userId: u.id })
          .execute();

        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + MeService.EMAIL_TOKEN_TTL_MS);

        const tokenRow = manager.create(EmailVerificationTokenEntity, {
          userId: u.id,
          newEmail: next,
          token,
          expiresAt,
          usedAt: null
        });
        const savedToken = await manager.save(tokenRow);

        await this.outboxService.addEvent(manager, {
          tenantId,
          aggregateType: OUTBOX_AGGREGATE_TYPE_EMAIL_VERIFICATION_TOKEN,
          aggregateId: savedToken.id,
          eventType: OUTBOX_EVENT_TYPE_IDENTITY_EMAIL_VERIFICATION_SEND,
          payload: { to: next, token }
        });

        await this.tenantAuditEventsService.append(
          {
            tenantId,
            actorUserId: userId,
            actor: this.selfActorLabel({ email: priorEmail }, userId),
            userId,
            action: TenantAuditAction.PROFILE_EMAIL_VERIFICATION_STARTED,
            resourceType: "email_verification",
            resourceId: savedToken.id,
            metadata: {
              prior_email_domain: this.emailPublicSuffix(priorEmail) ?? "",
              new_email_domain: this.emailPublicSuffix(next) ?? "",
              ...this.workspaceRoleAuditFields()
            },
            clientIp: this.requestContext.tryGetClientIp(),
            requestId: this.requestContext.tryGetRequestId() ?? null
          },
          manager
        );

        return {
          status: "pending_email_verification",
          profile_row_version: u.profileRowVersion
        };
      }

      const visibility = this.selfProfileVisibility(userId);
      const beforeSelfPii = snapshotSelfPiiFromUser(user, visibility);
      await this.applyMePatchDtoToUser(repo, user, dto);
      await this.persistUserProfileOrNationalIdConflict(repo, user);

      const changed = diffSelfPiiFieldKeys(beforeSelfPii, snapshotSelfPiiFromUser(user, visibility));
      if (changed.length > 0) {
        await this.tenantAuditEventsService.append(
          {
            tenantId,
            actorUserId: userId,
            actor: this.selfActorLabel(user, userId),
            userId,
            action: TenantAuditAction.PROFILE_SELF_PII_FIELDS_UPDATED,
            resourceType: "user_profile",
            resourceId: userId,
            metadata: {
              fields: changed,
              ...this.workspaceRoleAuditFields()
            },
            clientIp: this.requestContext.tryGetClientIp(),
            requestId: this.requestContext.tryGetRequestId() ?? null
          },
          manager
        );
      }

      return mapUserEntityToMeProfileResponse(user, visibility);
    });
  }

  async verifyEmail(token: string): Promise<EmailVerifiedResponse> {
    const { tenantId, userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(tenantId, userId);

    const trimmed = token.trim();

    let resolvedEmail = "";
    await this.withProfileMutationTransaction(async (manager) => {
      const row = await manager.findOne(EmailVerificationTokenEntity, {
        where: {
          token: trimmed,
          usedAt: IsNull(),
          expiresAt: MoreThan(new Date())
        },
        lock: { mode: "pessimistic_write" }
      });

      if (!row || row.userId !== userId) {
        throw new BadRequestException({
          error: {
            code: "EMAIL_VERIFICATION_INVALID",
            message: "Invalid or expired verification token"
          }
        });
      }

      const userRepo = manager.getRepository(UserEntity);
      const ownerOfEmail = await this.findActiveUserByEmailCaseInsensitive(userRepo, row.newEmail);
      if (ownerOfEmail && ownerOfEmail.id !== userId) {
        throw new ConflictException({
          error: {
            code: "USER_EMAIL_CONFLICT",
            message: "Email is already in use by another account"
          }
        });
      }

      const user = await userRepo.findOne({
        where: { id: userId, deletedAt: IsNull() }
      });
      if (!user) {
        throw new NotFoundException({
          error: { code: "USER_NOT_FOUND", message: "User not found" }
        });
      }

      const priorEmail = user.email.trim();
      user.email = row.newEmail;
      user.isEmailVerified = true;
      await this.persistUserProfileOrNationalIdConflict(userRepo, user);

      row.usedAt = new Date();
      await manager.save(row);

      resolvedEmail = user.email;

      await this.tenantAuditEventsService.append(
        {
          tenantId,
          actorUserId: userId,
          actor: this.selfActorLabel({ email: priorEmail }, userId),
          userId,
          action: TenantAuditAction.PROFILE_EMAIL_VERIFIED,
          resourceType: "user_profile",
          resourceId: userId,
          metadata: {
            prior_email_domain: this.emailPublicSuffix(priorEmail) ?? "",
            new_email_domain: this.emailPublicSuffix(row.newEmail) ?? "",
            ...this.workspaceRoleAuditFields()
          },
          clientIp: this.requestContext.tryGetClientIp(),
          requestId: this.requestContext.tryGetRequestId() ?? null
        },
        manager
      );
    });

    return { status: "email_verified", email: resolvedEmail };
  }

  private async findUserByNormalizedPhoneExclusive(
    normalizedPhone: string,
    excludeUserId: string
  ): Promise<UserEntity | null> {
    // tenant-isolation:qb-exempt — global phone uniqueness probe; caller holds tenant-scoped auth context.
    return this.userRepository
      .createQueryBuilder("u")
      .where("u.deleted_at IS NULL")
      .andWhere("u.id != :excludeUserId", { excludeUserId })
      .andWhere("phone_normalized(u.phone) = phone_normalized(:phone)", { phone: normalizedPhone })
      .getOne();
  }

  async requestChangeMobile(newMobile: string): Promise<{ challenge_id: string }> {
    const { tenantId, userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(tenantId, userId);

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new NotFoundException({
        error: { code: "USER_NOT_FOUND", message: "User not found" }
      });
    }

    const normalized = normalizeOtpPhoneInput(newMobile.trim());
    if (user.phone && normalizeOtpPhoneInput(user.phone) === normalized) {
      throw new BadRequestException({
        error: {
          code: "USER_PHONE_UNCHANGED",
          message: "New mobile matches your current number"
        }
      });
    }

    const taken = await this.findUserByNormalizedPhoneExclusive(normalized, userId);
    if (taken) {
      throw new ConflictException({
        error: {
          code: "USER_PHONE_CONFLICT",
          message: "Phone number is already in use"
        }
      });
    }

    const { challengeId } = await this.otpService.createMobileOtpChallenge(normalized, "change_mobile");
    return { challenge_id: challengeId };
  }

  async verifyChangeMobile(challengeId: string, code: string): Promise<MobileChangedResponse> {
    const { tenantId, userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(tenantId, userId);

    let verified: { success: true; mobile: string; purpose: "login" | "change_mobile" };
    try {
      verified = await this.otpService.verifyMobileOtp(challengeId, code);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        const body = err.getResponse();
        throw new BadRequestException(typeof body === "object" && body !== null ? body : { error: { message: "Invalid OTP" } });
      }
      throw err;
    }

    if (verified.purpose !== "change_mobile") {
      throw new BadRequestException({
        error: {
          code: "MOBILE_OTP_INVALID_PURPOSE",
          message: "OTP challenge is not for mobile change"
        }
      });
    }

    const taken = await this.findUserByNormalizedPhoneExclusive(verified.mobile, userId);
    if (taken) {
      throw new ConflictException({
        error: {
          code: "USER_PHONE_CONFLICT",
          message: "Phone number is already in use"
        }
      });
    }

    await this.withProfileMutationTransaction(async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const user = await userRepo.findOne({
        where: { id: userId, deletedAt: IsNull() }
      });
      if (!user) {
        throw new NotFoundException({
          error: { code: "USER_NOT_FOUND", message: "User not found" }
        });
      }

      user.phone = verified.mobile;
      user.isPhoneVerified = true;
      await this.persistUserProfileOrNationalIdConflict(userRepo, user);

      await this.tenantAuditEventsService.append(
        {
          tenantId,
          actorUserId: userId,
          actor: this.selfActorLabel(user, userId),
          userId,
          action: TenantAuditAction.PROFILE_PHONE_UPDATED_SELF,
          resourceType: "user_profile",
          resourceId: userId,
          metadata: this.workspaceRoleAuditFields(),
          clientIp: this.requestContext.tryGetClientIp(),
          requestId: this.requestContext.tryGetRequestId() ?? null
        },
        manager
      );
    });

    return { status: "mobile_changed", mobile: verified.mobile };
  }
}
