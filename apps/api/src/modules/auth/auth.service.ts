import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { IsNull, QueryFailedError, Repository } from "typeorm";
import { loadPrivateKey, loadPublicKey } from "../../auth/jwt-key.util";
import { normalizeOtpPhoneInput } from "../../common/phone/otp-phone-normalize";
import { LoggerService } from "../../common/logger/logger.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
import { TenantAuditAction } from "../../common/audit/tenant-audit-actions";
import { ConfigService } from "../../config/config.service";
import { UserEntity } from "../identity/entities/user.entity";
import { UserTenantEntity } from "../identity/entities/user-tenant.entity";
import {
  WorkspaceInviteEntity,
  WorkspaceInviteStatus
} from "../identity/entities/workspace-invite.entity";
import { MembershipStatus } from "../identity/membership-status.enum";
import type { CompleteRegistrationDto } from "./dto/complete-registration.dto";
import type { PhonePreflightDto } from "./dto/phone-preflight.dto";
import type { LinkTelegramDto } from "./dto/link-telegram.dto";
import type { WebSessionResponseDto } from "./dto/auth-session-response.dto";
import type { PhoneSessionDto } from "./dto/phone-session.dto";
import type { TelegramSessionDto } from "./dto/telegram-session.dto";
import type { WorkspaceSessionDto } from "./dto/workspace-session.dto";
import { OtpService } from "./otp.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserTenantEntity)
    private readonly userTenantRepository: Repository<UserTenantEntity>,
    @InjectRepository(WorkspaceInviteEntity)
    private readonly workspaceInviteRepository: Repository<WorkspaceInviteEntity>,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService) private readonly loggerService: LoggerService,
    @Inject(TenantAuditEventsService)
    private readonly tenantAuditEventsService: TenantAuditEventsService,
    @Inject(OtpService) private readonly otpService: OtpService
  ) {}

  private makeOnboardingEmailFromPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    const suffix = digits.length > 0 ? digits : randomUUID().replace(/-/g, "");
    return `phone_${suffix}@local.invalid`;
  }

  private maskPhoneForLog(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) {
      return "***";
    }
    if (digits.length <= 4) {
      return `***${digits}`;
    }
    return `***${digits.slice(-4)}`;
  }

  private isDevStaticOtpEnabled(): boolean {
    const nodeEnv = this.configService.getNodeEnv();
    return (
      (nodeEnv === "development" || nodeEnv === "test") &&
      this.configService.getAuthAllowDevStaticOtp()
    );
  }

  private parseTelegramInitPayload(
    telegramInitPayload: string
  ): { telegramUserId: string } {
    const params = new URLSearchParams(telegramInitPayload);
    const hash = params.get("hash");
    if (!hash) {
      throw new UnauthorizedException("AUTH_TELEGRAM_CONTEXT_REQUIRED");
    }

    const dataEntries: string[] = [];
    for (const [key, value] of params.entries()) {
      if (key !== "hash") {
        dataEntries.push(`${key}=${value}`);
      }
    }
    dataEntries.sort();
    const dataCheckString = dataEntries.join("\n");

    const secretKey = createHash("sha256")
      .update(this.configService.getTelegramBotToken(), "utf8")
      .digest();
    const computedHash = createHmac("sha256", secretKey)
      .update(dataCheckString, "utf8")
      .digest("hex");

    const provided = Buffer.from(hash, "hex");
    const computed = Buffer.from(computedHash, "hex");
    if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
      throw new UnauthorizedException("AUTH_TELEGRAM_CONTEXT_REQUIRED");
    }

    const userJson = params.get("user");
    if (!userJson) {
      throw new UnauthorizedException("AUTH_TELEGRAM_CONTEXT_REQUIRED");
    }

    try {
      const user = JSON.parse(userJson) as { id?: unknown };
      if (
        (typeof user.id !== "number" && typeof user.id !== "string") ||
        String(user.id).trim() === ""
      ) {
        throw new Error("invalid");
      }
      return { telegramUserId: String(user.id).trim() };
    } catch {
      throw new UnauthorizedException("AUTH_TELEGRAM_CONTEXT_REQUIRED");
    }
  }

  private async signAccessToken(input: {
    userId: string;
    tenantId: string;
    role: string;
    email?: string | null;
    sessionVersion: number;
  }): Promise<string> {
    const privateKey = await loadPrivateKey(this.configService.getJwtPrivateKey());

    const payload: Record<string, string | number> = {
      tenant_id: input.tenantId,
      role: input.role,
      sess_ver: input.sessionVersion
    };
    if (typeof input.email === "string" && input.email.trim() !== "") {
      payload.email = input.email;
    }

    return new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setSubject(input.userId)
      .setIssuer(this.configService.getJwtIssuer())
      .setAudience(this.configService.getJwtAudience())
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
  }

  private isPhoneOtpCodeValid(otp: string): boolean {
    return this.isDevStaticOtpEnabled() && otp.trim() === "1234";
  }

  async requestPhoneOtp(
    phone: string
  ): Promise<{ otp_requested: true; delivery: "dev_static"; challenge_id: string }> {
    const normalizedPhone = phone.trim();
    const { challengeId } = await this.otpService.createMobileOtpChallenge(normalizedPhone, "login");
    return {
      otp_requested: true,
      delivery: "dev_static",
      challenge_id: challengeId
    };
  }

  async preflightPhone(dto: PhonePreflightDto): Promise<{
    mode: "existing_user" | "new_user";
    invite_pending: boolean;
    phone: string;
  }> {
    const normalizedPhone = dto.phone.trim();
    const user = await this.findUserByPhone(normalizedPhone);
    const invitePending = await this.hasPendingInviteForPhone(normalizedPhone, dto.invite_token);
    return {
      mode: user ? "existing_user" : "new_user",
      invite_pending: invitePending,
      phone: normalizedPhone
    };
  }

  private async findUserByPhone(phone: string): Promise<UserEntity | null> {
    const trimmed = phone.trim();
    if (!trimmed) {
      return null;
    }
    const user = await this.userRepository
      .createQueryBuilder("u")
      .where("u.deleted_at IS NULL")
      .andWhere("phone_normalized(u.phone) = phone_normalized(:phone)", { phone: trimmed })
      .getOne();
    if (!user) {
      const userWithBrokenNormalizedPhone = await this.userRepository
        .createQueryBuilder("u")
        .select(["u.id", "u.phone"])
        .where("u.deleted_at IS NULL")
        .andWhere("u.phone = :phone", { phone: trimmed })
        .andWhere("(phone_normalized(u.phone) IS NULL OR phone_normalized(u.phone) = '')")
        .getOne();
      if (userWithBrokenNormalizedPhone) {
        this.loggerService.error("auth_phone_normalization_data_issue", {
          user_id: userWithBrokenNormalizedPhone.id,
          masked_phone: this.maskPhoneForLog(userWithBrokenNormalizedPhone.phone),
          input_masked_phone: this.maskPhoneForLog(trimmed)
        });
      }
    }
    return user;
  }

  private async hasPendingInviteForPhone(
    phone: string,
    inviteToken?: string
  ): Promise<boolean> {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) return false;
    try {
      const query = this.workspaceInviteRepository
        .createQueryBuilder("wi")
        .select("wi.id", "id")
        .where("wi.status = :status", { status: WorkspaceInviteStatus.PENDING })
        .andWhere("wi.expires_at > now()")
        .andWhere("phone_normalized(wi.email) = phone_normalized(:phone)", { phone: normalizedPhone });
      if (inviteToken && inviteToken.trim() !== "") {
        query.andWhere("wi.invite_token = :inviteToken", { inviteToken: inviteToken.trim() });
      }
      const invite = await query.getRawOne<{ id: string }>();
      return Boolean(invite?.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const isQueryFailedError =
        error instanceof QueryFailedError ||
        (typeof error === "object" &&
          error !== null &&
          "name" in error &&
          (error as { name?: unknown }).name === "QueryFailedError");
      const missingColumnMatch =
        error instanceof Error ? error.message.match(/column\s+([a-z_]+\.[a-z_]+)\s+does not exist/i) : null;
      const missingColumnRef = missingColumnMatch?.[1]?.toLowerCase();
      const isMissingInviteColumnError =
        isQueryFailedError &&
        message.includes("does not exist") &&
        (message.includes("workspace_invites") || Boolean(missingColumnRef?.startsWith("wi.")));
      if (isMissingInviteColumnError) {
        this.loggerService.warn("AUTH_INVITE_LOOKUP_MISSING_COLUMN", {
          table: "workspace_invites",
          column: missingColumnRef ?? "unknown",
          masked_phone: this.maskPhoneForLog(normalizedPhone),
          invite_token_present: Boolean(inviteToken && inviteToken.trim() !== "")
        });
        return false;
      }
      throw error;
    }
  }

  private async issueOnboardingToken(input: {
    phone: string;
    tenantId: string;
    inviteToken?: string;
  }): Promise<string> {
    const privateKey = await loadPrivateKey(this.configService.getJwtPrivateKey());
    const payload: Record<string, string> = {
      phone: input.phone,
      tenant_id: input.tenantId
    };
    if (input.inviteToken && input.inviteToken.trim() !== "") {
      payload.invite_token = input.inviteToken.trim();
    }
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setSubject("onboarding")
      .setIssuer(this.configService.getJwtIssuer())
      .setAudience(this.configService.getJwtAudience())
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);
  }

  private async verifyOnboardingToken(token: string): Promise<{
    phone: string;
    tenantId: string;
    inviteToken?: string;
  }> {
    const publicKey = await loadPublicKey(this.configService.getJwtPublicKey());
    const verified = await jwtVerify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: this.configService.getJwtIssuer(),
      audience: this.configService.getJwtAudience(),
      clockTolerance: "5s"
    });
    const payload = verified.payload as Record<string, unknown>;
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const tenantId = typeof payload.tenant_id === "string" ? payload.tenant_id.trim() : "";
    const inviteToken = typeof payload.invite_token === "string" ? payload.invite_token.trim() : undefined;
    if (!phone || !tenantId) {
      throw new UnauthorizedException({
        error: {
          code: "INVALID_INPUT",
          message: "Invalid onboarding token payload"
        }
      });
    }
    return { phone, tenantId, inviteToken };
  }

  async validatePhoneOtp(phone: string, otp: string): Promise<UserEntity | null> {
    if (!this.isDevStaticOtpEnabled()) {
      return null;
    }
    if (!this.isPhoneOtpCodeValid(otp)) {
      return null;
    }
    const trimmed = phone.trim();
    if (!trimmed) {
      return null;
    }
    return this.findUserByPhone(trimmed);
  }

  async createWebSessionOtp(dto: PhoneSessionDto): Promise<WebSessionResponseDto> {
    const resolvedTenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!resolvedTenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Workspace tenant must be resolved from the HTTP Host (tenant subdomain)"
        }
      });
    }
    this.requestContextService.setTenantId(resolvedTenantId);

    const trimmedOtp = dto.otp.trim();
    const challengeId = dto.challenge_id?.trim();

    let user: UserEntity | null;
    if (challengeId) {
      const verified = await this.otpService.verifyMobileOtp(challengeId, trimmedOtp);
      if (verified.purpose !== "login") {
        throw new UnauthorizedException({
          error: {
            code: "AUTH_OTP_INVALID",
            message: "Invalid OTP challenge for login"
          }
        });
      }
      const phoneNorm = normalizeOtpPhoneInput(dto.phone);
      if (phoneNorm !== verified.mobile) {
        throw new UnauthorizedException({
          error: {
            code: "AUTH_OTP_INVALID",
            message: "Phone does not match OTP challenge"
          }
        });
      }
      user = await this.findUserByPhone(verified.mobile);
    } else {
      const isDevStaticOtpEnabled = this.isDevStaticOtpEnabled();
      if (isDevStaticOtpEnabled && trimmedOtp !== "1234") {
        throw new UnauthorizedException({
          error: {
            code: "AUTH_OTP_INVALID",
            message: "Invalid OTP code"
          }
        });
      }

      user = await this.validatePhoneOtp(dto.phone, dto.otp);
    }
    if (!user) {
      if (!this.isDevStaticOtpEnabled()) {
        throw new UnauthorizedException({
          error: {
            code: "AUTH_PHONE_INVALID",
            message: "Invalid phone or OTP"
          }
        });
      }
      const onboardingToken = await this.issueOnboardingToken({
        phone: dto.phone.trim(),
        tenantId: resolvedTenantId,
        inviteToken: dto.invite_token
      });
      return {
        session_token: "",
        user_id: "",
        tenant_id: resolvedTenantId,
        entry_mode: "web",
        requires_registration: true,
        onboarding_token: onboardingToken
      };
    }

    const membership = await this.userTenantRepository.findOne({
      where: {
        userId: user.id,
        tenantId: resolvedTenantId,
        deletedAt: IsNull(),
        status: MembershipStatus.ACTIVE
      }
    });
    const anyMembership = membership
      ? membership
      : await this.userTenantRepository.findOne({
          where: {
            userId: user.id,
            tenantId: resolvedTenantId,
            deletedAt: IsNull()
          }
        });

    if (!membership) {
      const membershipStatus = anyMembership?.status ?? "NONE";
      throw new ForbiddenException({
        error: {
          code: "AUTH_NO_ACTIVE_MEMBERSHIP",
          message: "User does not have an ACTIVE membership in this workspace tenant"
        },
        tenant_id: resolvedTenantId,
        user_id: user.id,
        membership_status: membershipStatus,
        no_active_membership: true
      });
    }

    let accessToken: string;
    try {
      accessToken = await this.signAccessToken({
        userId: user.id,
        tenantId: resolvedTenantId,
        role: membership.role,
        email: user.email ?? null,
        sessionVersion: membership.sessionVersion
      });
    } catch (error: unknown) {
      this.loggerService.error("auth_web_otp_session_issuance_result", {
        success: false,
        error_name: error instanceof Error ? error.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }

    void this.tenantAuditEventsService.appendOrWarn({
      tenantId: resolvedTenantId,
      actorUserId: user.id,
      actor: user.email,
      userId: user.id,
      action: TenantAuditAction.AUTH_LOGIN_WEB,
      resourceType: "session",
      resourceId: "web",
      clientIp: this.requestContextService.tryGetClientIp(),
      requestId: this.requestContextService.tryGetRequestId()
    });

    const response: WebSessionResponseDto = {
      session_token: accessToken,
      user_id: user.id,
      tenant_id: resolvedTenantId,
      entry_mode: "web"
    };
    return response;
  }

  private normalizeUuidString(value: string): string {
    return value.trim().toLowerCase();
  }

  /**
   * Ensures `userId` has an active user_tenants row for `tenantId` (non-deleted tenant).
   *
   * @returns `role` from user_tenants when the user belongs to the tenant.
   * @throws {ForbiddenException} HTTP 403 when the user does not belong to `tenantId`.
   */
  private async requireUserTenantMembershipRole(
    userId: string,
    tenantId: string
  ): Promise<{ role: string; sessionVersion: number }> {
    const target = this.normalizeUuidString(tenantId);
    const membership = await this.userTenantRepository.findOne({
      where: {
        userId,
        tenantId: target,
        deletedAt: IsNull(),
        status: MembershipStatus.ACTIVE
      }
    });
    if (!membership) {
      this.loggerService.warn("workspace session denied: user has no membership for tenant", {
        userId,
        tenantId: target
      });
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "User does not belong to the requested tenant"
        }
      });
    }
    return { role: membership.role, sessionVersion: membership.sessionVersion };
  }

  /**
   * Re-issues a JWT for `dto.tenant_id` when the caller (JWT `sub`) has an active membership
   * for that tenant.
   */
  async createWorkspaceSession(
    userId: string,
    dto: WorkspaceSessionDto,
    hostResolvedTenant: Request["tenant"] | undefined,
    jwtTenantIdForAudit: string
  ): Promise<{
    session_token: string;
    user_id: string;
    tenant_id: string;
    entry_mode: "web";
  }> {
    const targetTenantId = dto.tenant_id.trim();
    if (!targetTenantId) {
      throw new BadRequestException({
        error: {
          code: "INVALID_INPUT",
          message: "tenant_id is required"
        }
      });
    }

    if (hostResolvedTenant?.id) {
      const hostId = this.normalizeUuidString(hostResolvedTenant.id);
      const requested = this.normalizeUuidString(targetTenantId);
      if (hostId !== requested) {
        throw new ForbiddenException({
          error: {
            code: "TENANT_HOST_MISMATCH",
            message:
              "Requested workspace must match the tenant subdomain (HTTP Host); open this workspace on its host before exchanging the session."
          }
        });
      }
    }

    const { role, sessionVersion } = await this.requireUserTenantMembershipRole(
      userId,
      targetTenantId
    );

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() }
    });
    if (!user) {
      throw new UnauthorizedException({
        error: {
          code: "AUTH_UNAUTHENTICATED",
          message: "User not found"
        }
      });
    }

    const accessToken = await this.signAccessToken({
      userId: user.id,
      tenantId: this.normalizeUuidString(targetTenantId),
      role,
      email: user.email ?? null,
      sessionVersion
    });

    const fromTenant = this.normalizeUuidString(jwtTenantIdForAudit);
    const toTenant = this.normalizeUuidString(targetTenantId);
    void this.tenantAuditEventsService.appendOrWarn({
      tenantId: fromTenant,
      actorUserId: user.id,
      actor: user.email,
      userId: user.id,
      action: TenantAuditAction.AUTH_WORKSPACE_SWITCH,
      resourceType: "workspace",
      resourceId: toTenant,
      metadata: { from_tenant_id: fromTenant, to_tenant_id: toTenant },
      clientIp: this.requestContextService.tryGetClientIp(),
      requestId: this.requestContextService.tryGetRequestId()
    });

    return {
      session_token: accessToken,
      user_id: user.id,
      tenant_id: this.normalizeUuidString(targetTenantId),
      entry_mode: "web"
    };
  }

  async completeRegistration(dto: CompleteRegistrationDto): Promise<WebSessionResponseDto> {
    const onboarding = await this.verifyOnboardingToken(dto.onboarding_token);
    const fullName = dto.full_name.trim();
    const requestedEmail = dto.email?.trim();
    if (!fullName) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "full_name is required"
        }
      });
    }

    const existing = await this.findUserByPhone(onboarding.phone);
    const normalizedEmail = requestedEmail && requestedEmail !== "" ? requestedEmail : this.makeOnboardingEmailFromPhone(onboarding.phone);

    const user = existing
      ? await this.userRepository.save({
          ...existing,
          fullName,
          phone: onboarding.phone,
          isPhoneVerified: true,
          email: existing.email?.trim() ? existing.email : normalizedEmail
        })
      : await this.userRepository.save(
          this.userRepository.create({
            email: normalizedEmail,
            hashedPassword: await argon2.hash(randomUUID()),
            fullName,
            phone: onboarding.phone,
            isPhoneVerified: true
          })
        );

    let membership = await this.userTenantRepository.findOne({
      where: {
        userId: user.id,
        tenantId: onboarding.tenantId,
        deletedAt: IsNull()
      }
    });
    if (!membership) {
      membership = await this.userTenantRepository.save(
        this.userTenantRepository.create({
          userId: user.id,
          tenantId: onboarding.tenantId,
          role: "member",
          status: MembershipStatus.ACTIVE,
          invitedAt: null,
          joinedAt: new Date(),
          suspendedAt: null
        })
      );
    } else if (membership.status !== MembershipStatus.ACTIVE) {
      membership.status = MembershipStatus.ACTIVE;
      membership.joinedAt = membership.joinedAt ?? new Date();
      membership.suspendedAt = null;
      membership = await this.userTenantRepository.save(membership);
    }

    const accessToken = await this.signAccessToken({
      userId: user.id,
      tenantId: onboarding.tenantId,
      role: membership.role,
      email: user.email ?? null,
      sessionVersion: membership.sessionVersion
    });

    void this.tenantAuditEventsService.appendOrWarn({
      tenantId: onboarding.tenantId,
      actorUserId: user.id,
      actor: user.email,
      userId: user.id,
      action: TenantAuditAction.AUTH_LOGIN_WEB,
      resourceType: "registration",
      resourceId: "phone",
      metadata: { registration_completed: true },
      clientIp: this.requestContextService.tryGetClientIp(),
      requestId: this.requestContextService.tryGetRequestId()
    });

    return {
      session_token: accessToken,
      user_id: user.id,
      tenant_id: onboarding.tenantId,
      entry_mode: "web"
    };
  }

  async createTelegramSession(
    req: Request,
    dto: TelegramSessionDto
  ): Promise<{
    session_token: string;
    user_id: string;
    tenant_id: string;
    entry_mode: "telegram";
  }> {
    const { telegramUserId } = this.parseTelegramInitPayload(
      dto.telegram_init_payload
    );

    const tenant = req.tenant;
    if (!tenant) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Workspace tenant must be resolved from the HTTP Host (tenant subdomain)"
        }
      });
    }
    const resolvedTenantId = this.normalizeUuidString(tenant.id);

    let user = await this.userRepository.findOne({
      where: {
        telegramUserId,
        deletedAt: IsNull()
      }
    });

    if (!user) {
      user = await this.userRepository.save(
        this.userRepository.create({
          email: `telegram_${telegramUserId}@local.invalid`,
          hashedPassword: await argon2.hash(randomUUID()),
          telegramUserId
        })
      );
    }

    this.requestContextService.setTenantId(resolvedTenantId);

    const membership = await this.userTenantRepository.findOne({
      where: {
        userId: user.id,
        tenantId: resolvedTenantId,
        deletedAt: IsNull(),
        status: MembershipStatus.ACTIVE
      }
    });

    if (!membership) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "User does not belong to this workspace tenant"
        }
      });
    }

    const accessToken = await this.signAccessToken({
      userId: user.id,
      tenantId: resolvedTenantId,
      role: membership.role,
      email: user.email ?? null,
      sessionVersion: membership.sessionVersion
    });

    void this.tenantAuditEventsService.appendOrWarn({
      tenantId: resolvedTenantId,
      actorUserId: user.id,
      actor: user.email,
      userId: user.id,
      action: TenantAuditAction.AUTH_LOGIN_TELEGRAM,
      resourceType: "session",
      resourceId: "telegram",
      clientIp: this.requestContextService.tryGetClientIp(),
      requestId: this.requestContextService.tryGetRequestId()
    });

    return {
      session_token: accessToken,
      user_id: user.id,
      tenant_id: resolvedTenantId,
      entry_mode: "telegram"
    };
  }

  async linkTelegram(
    userId: string,
    sessionTenantId: string,
    dto: LinkTelegramDto
  ): Promise<{
    user_id: string;
    linked_telegram_user_id: string;
    link_status: "Linked";
    linked_at: string;
  }> {
    const { telegramUserId } = this.parseTelegramInitPayload(
      dto.telegram_init_payload
    );

    const resolvedTenantId = this.normalizeUuidString(sessionTenantId);
    this.requestContextService.setTenantId(resolvedTenantId);

    const membership = await this.userTenantRepository.findOne({
      where: {
        userId,
        tenantId: resolvedTenantId,
        deletedAt: IsNull()
      }
    });

    if (!membership) {
      throw new ForbiddenException("TENANT_SCOPE_FORBIDDEN");
    }

    const currentUser = await this.userRepository.findOne({
      where: {
        id: userId,
        deletedAt: IsNull()
      }
    });
    if (!currentUser) {
      throw new UnauthorizedException("AUTH_UNAUTHENTICATED");
    }

    const linkedToAnother = await this.userRepository.findOne({
      where: {
        telegramUserId,
        deletedAt: IsNull()
      }
    });
    if (linkedToAnother && linkedToAnother.id !== userId) {
      throw new BadRequestException("STATE_TRANSITION_INVALID");
    }

    if (
      currentUser.telegramUserId &&
      currentUser.telegramUserId !== telegramUserId
    ) {
      throw new BadRequestException("STATE_TRANSITION_INVALID");
    }

    currentUser.telegramUserId = telegramUserId;
    await this.userRepository.save(currentUser);

    return {
      user_id: userId,
      linked_telegram_user_id: telegramUserId,
      link_status: "Linked",
      linked_at: new Date().toISOString()
    };
  }
}
