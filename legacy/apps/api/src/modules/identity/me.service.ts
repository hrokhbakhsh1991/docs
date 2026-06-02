import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { EntityManager, QueryFailedError } from "typeorm";

import { TenantAuditAction } from "../../common/audit/tenant-audit-actions";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { normalizeOtpPhoneInput } from "../../common/phone/otp-phone-normalize";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { OtpService } from "../auth/otp.service";
import { getIdempotentEntityManager } from "../idempotency/idempotent-transaction.context";
import { OutboxService } from "../outbox/outbox.service";
import type { PatchMeDto } from "./dto/patch-me.dto";
import type { IdentityUserRecord } from "./domain/identity-records";
import {
  WORKSPACE_IDENTITY_REPOSITORY_PORT,
  type WorkspaceIdentityRepositoryPort
} from "./domain/ports/workspace-identity-repository.port";
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
    @Inject(WORKSPACE_IDENTITY_REPOSITORY_PORT)
    private readonly identityRepository: WorkspaceIdentityRepositoryPort,
    @Inject(UsersAccessService)
    private readonly usersAccess: UsersAccessService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
    @Inject(OutboxService)
    private readonly outboxService: OutboxService,
    @Inject(OtpService)
    private readonly otpService: OtpService,
    @Inject(TenantAuditEventsService)
    private readonly tenantAuditEventsService: TenantAuditEventsService
  ) {}

  private emailPublicSuffix(email: string): string | null {
    const t = email.trim().toLowerCase();
    const at = t.lastIndexOf("@");
    if (at < 1 || at === t.length - 1) {
      return null;
    }
    return t.slice(at + 1);
  }

  private selfActorLabel(user: Pick<IdentityUserRecord, "email">, userId: string): string {
    const e = user.email?.trim();
    return e !== undefined && e !== "" ? e : userId;
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
    user: IdentityUserRecord,
    manager?: EntityManager
  ): Promise<void> {
    try {
      await this.identityRepository.saveUser(user, manager);
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
    run: (_manager: EntityManager) => Promise<T>
  ): Promise<T> {
    const em = getIdempotentEntityManager();
    if (em) {
      return run(em);
    }
    return this.identityRepository.runInTransaction(run);
  }

  private assertExpectedProfileRowVersion(
    expected: number | undefined,
    entity: Pick<IdentityUserRecord, "profileRowVersion">
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
    user: IdentityUserRecord,
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
    const taken = await this.identityRepository.findUserByNationalIdActive(value);
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

  private applyBirthDatePatchOrThrow(user: IdentityUserRecord, value: string | null): void {
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

  private async applyMePatchDtoToUser(user: IdentityUserRecord, dto: PatchMeDto): Promise<void> {
    if (dto.full_name !== undefined) {
      user.fullName = dto.full_name === null ? null : dto.full_name;
    }

    if (dto.notifications_enabled !== undefined) {
      user.notificationsEnabled = dto.notifications_enabled;
    }

    if (dto.national_id !== undefined) {
      await this.applyNationalIdPatchOrThrow(user, dto.national_id);
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
    const { userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(userId);

    const user = await this.identityRepository.findUserById(userId);
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
    await this.usersAccess.ensureActorMembershipOrThrow(userId);

    return this.withProfileMutationTransaction(async (manager) => {
      const user = await this.identityRepository.findUserById(userId, manager);
      if (!user) {
        throw new NotFoundException({
          error: { code: "USER_NOT_FOUND", message: "User not found" }
        });
      }

      this.assertExpectedProfileRowVersion(concurrency?.expectedProfileRowVersion, user);

      const wantsEmailVerificationFlow =
        dto.email !== undefined &&
        dto.email.trim().toLowerCase() !== (user.email ?? "").trim().toLowerCase();

      if (wantsEmailVerificationFlow) {
        const next = dto.email!.trim();
        const u = user;
        const priorEmail = (u.email ?? "").trim();
        await this.applyMePatchDtoToUser(u, dto);

        const ownerOfEmail = await this.identityRepository.findUserByEmailExact(next, manager);
        if (ownerOfEmail && ownerOfEmail.id !== u.id) {
          throw new ConflictException({
            error: {
              code: "USER_EMAIL_CONFLICT",
              message: "Email is already in use"
            }
          });
        }

        await this.persistUserProfileOrNationalIdConflict(u, manager);

        await this.identityRepository.deletePendingEmailVerificationTokens(u.id, manager);

        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + MeService.EMAIL_TOKEN_TTL_MS);

        const tokenRow = this.identityRepository.createEmailVerificationToken(
          {
            userId: u.id,
            newEmail: next,
            token,
            expiresAt,
            usedAt: null
          },
          manager
        );
        const savedToken = await this.identityRepository.saveEmailVerificationToken(tokenRow, manager);

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
      await this.applyMePatchDtoToUser(user, dto);
      await this.persistUserProfileOrNationalIdConflict(user, manager);

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
    await this.usersAccess.ensureActorMembershipOrThrow(userId);

    const trimmed = token.trim();

    let resolvedEmail = "";
    await this.withProfileMutationTransaction(async (manager) => {
      const row = await this.identityRepository.findLockedValidEmailVerificationToken(trimmed, manager);

      if (!row || row.userId !== userId) {
        throw new BadRequestException({
          error: {
            code: "EMAIL_VERIFICATION_INVALID",
            message: "Invalid or expired verification token"
          }
        });
      }

      const ownerOfEmail = await this.identityRepository.findActiveUserByEmailCaseInsensitive(
        row.newEmail,
        manager
      );
      if (ownerOfEmail && ownerOfEmail.id !== userId) {
        throw new ConflictException({
          error: {
            code: "USER_EMAIL_CONFLICT",
            message: "Email is already in use by another account"
          }
        });
      }

      const user = await this.identityRepository.findUserById(userId, manager);
      if (!user) {
        throw new NotFoundException({
          error: { code: "USER_NOT_FOUND", message: "User not found" }
        });
      }

      const priorEmail = (user.email ?? "").trim();
      user.email = row.newEmail;
      user.isEmailVerified = true;
      await this.persistUserProfileOrNationalIdConflict(user, manager);

      row.usedAt = new Date();
      await this.identityRepository.saveEmailVerificationToken(row, manager);

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

  async requestChangeMobile(newMobile: string): Promise<{ challenge_id: string }> {
    const { userId } = this.resolveSelfOrThrow();
    await this.usersAccess.ensureActorMembershipOrThrow(userId);

    const user = await this.identityRepository.findUserById(userId);
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

    const taken = await this.identityRepository.findUserByNormalizedPhoneExclusive(normalized, userId);
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
    await this.usersAccess.ensureActorMembershipOrThrow(userId);

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

    const taken = await this.identityRepository.findUserByNormalizedPhoneExclusive(verified.mobile, userId);
    if (taken) {
      throw new ConflictException({
        error: {
          code: "USER_PHONE_CONFLICT",
          message: "Phone number is already in use"
        }
      });
    }

    await this.withProfileMutationTransaction(async (manager) => {
      const user = await this.identityRepository.findUserById(userId, manager);
      if (!user) {
        throw new NotFoundException({
          error: { code: "USER_NOT_FOUND", message: "User not found" }
        });
      }

      user.phone = verified.mobile;
      user.isPhoneVerified = true;
      await this.persistUserProfileOrNationalIdConflict(user, manager);

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
